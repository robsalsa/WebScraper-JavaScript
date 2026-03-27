const fs = require('fs');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

// Input CSV files
const KAIYODO_CSV = path.join(__dirname, '..', 'shit-scraper', 'out_file', 'kaiyodo', 'kaiyodo_AY.csv');
const SEXYICE_CSV = path.join(__dirname, '..', 'shit-scraper', 'out_file', 'sexyice', 'sexyice.csv');
const REDDIT_CSV = path.join(__dirname, '..', 'reddit-shit-scraper', 'out_file', 'ay-reddit-data.csv');

// Output file with today's date
// const today = new Date();
// const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
const OUTPUT_CSV = path.join(__dirname, 'name_out_file', `reddit-figures-names.csv`);


function parseCSV(filePath) {       //break everything into an array, handling multi-line quoted fields
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = [];
        let current = '';
        let inQuotes = false;
        
        // Split content into lines, respecting quoted multi-line fields
        for (let i = 0; i < content.length; i++) {
            const char = content[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
                current += char;
            } else if (char === '\n' && !inQuotes) {
                if (current.trim()) {
                    lines.push(current);
                }
                current = '';
            } else if (char === '\r') {
                // Skip carriage returns
                continue;
            } else {
                current += char;
            }
        }
        if (current.trim()) {
            lines.push(current);
        }
        
        const headers = parseCSVLine(lines[0]);
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            if (values.length === headers.length) {
                const row = {};
                headers.forEach((header, index) => {
                    row[header] = values[index];
                });
                data.push(row);
            }
        }
        return data;
    } catch (error) {
        console.error(`Error parsing CSV ${filePath}:`, error.message);
        return [];
    }
}


function parseCSVLine(line) {       //check that array for "" to replace to '', minimizing errors.
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current.trim().replace(/^"|"$/g, ''));
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current.trim().replace(/^"|"$/g, ''));
    
    return values;
}


function extractKeywordsWithPriority(figureName) {
    // Generic keyword extraction - works with ANY figure name structure
    // Handles: parentheses (nicknames), version numbers, multi-word names, etc.
    if (!figureName) return [];
    
    const name = figureName.toLowerCase();
    const keywords = [];
    
    // Priority 1: Full name - highest priority
    keywords.push({ text: name, priority: 1, type: 'full' });
    
    // Priority 2: Name without parentheses
    const withoutParens = name.replace(/\([^)]*\)/g, '').trim();
    if (withoutParens && withoutParens !== name) {
        keywords.push({ text: withoutParens, priority: 2, type: 'no-parens' });
    }
    
    // Priority 2: Content INSIDE parentheses (e.g., "Deku" from "Izuku Midoriya (Deku)")
    const parensContent = name.match(/\(([^)]+)\)/g);
    if (parensContent) {
        parensContent.forEach(match => {
            const inside = match.replace(/[()]/g, '').trim();
            if (inside.length >= 4) {  // Only meaningful names
                keywords.push({ text: inside, priority: 2, type: 'parens-content' });
            }
        });
    }
    
    // Priority 2: Name without version numbers (e.g., "Deathstroke" from "Deathstroke Ver1.5")
    const withoutVersion = name.replace(/\s*v(?:er)?\.?\s*\d+(?:\.\d+)?/gi, '').trim();
    if (withoutVersion && withoutVersion !== name && withoutVersion !== withoutParens) {
        keywords.push({ text: withoutVersion, priority: 2, type: 'no-version' });
    }
    
    // Priority 3: Multi-word phrases (2+ consecutive words)
    const words = withoutParens.split(/\s+/).filter(w => w.length > 0);
    if (words.length >= 2) {
        // Extract all consecutive word pairs and triplets
        for (let i = 0; i < words.length - 1; i++) {
            const twoWord = words.slice(i, i + 2).join(' ');
            if (twoWord.length >= 8) {  // Minimum 8 chars for phrases
                keywords.push({ text: twoWord, priority: 3, type: 'phrase' });
            }
            
            if (i < words.length - 2) {
                const threeWord = words.slice(i, i + 3).join(' ');
                if (threeWord.length >= 12) {
                    keywords.push({ text: threeWord, priority: 3, type: 'phrase' });
                }
            }
        }
    }
    
    // Priority 4: Individual significant words (must be longer to avoid false matches)
    // Blacklist common words that appear in many figure names but aren't distinctive
    // NOTE: "version" is intentionally NOT blacklisted as it helps identify specific figures
    const blacklistedWords = ['figure', 'edition', 'special', 'limited', 'exclusive', 'series', 'collection'];
    const significantWords = words.filter(w => w.length >= 6 && !blacklistedWords.includes(w));
    significantWords.forEach(word => {
        keywords.push({ text: word, priority: 4, type: 'word' });
    });
    
    // Normalize hyphens: Add hyphen-free versions of all keywords
    // This allows "Spider-Man" to match "spiderman" or "spider man"
    const normalizedKeywords = [];
    keywords.forEach(kw => {
        if (kw.text.includes('-')) {
            const noHyphen = kw.text.replace(/-/g, '');
            if (noHyphen.length >= 4) {
                normalizedKeywords.push({ 
                    text: noHyphen, 
                    priority: kw.priority, 
                    type: kw.type 
                });
            }
        }
    });
    
    return [...keywords, ...normalizedKeywords];
}


function detectIssues(redditPost) {
    // Extract quality issues mentioned in Reddit posts
    // Returns array of detected issue types
    // NOTE: This function can also be used in data-dresser.js for processing issue data
    const text = `${redditPost.Title} ${redditPost['Text (Preview)']}`.toLowerCase();
    const issues = [];
    
    // Issue patterns to detect
    const issuePatterns = {
        'loose_joints': /\b(loose|floppy|wobbly)\s*(joint|joints|limb|limbs|arm|arms|leg|legs)\b/i,
        'paint_defect': /\b(paint\s*(defect|issue|problem|error|mistake|bleed|chipping|chip|scratched?|rub))\b/i,
        'broken_parts': /\b(broken|cracked|snapped|damaged)\s*(part|piece|joint|peg|connector)\b/i,
        'missing_parts': /\b(missing|lost)\s*(part|piece|accessory|accessories)\b/i,
        // 'quality_control': /\b(qc|quality\s*control|quality\s*issue|quality\s*problem|defect)\b/i,
        'warped_parts': /\b(warped|bent|twisted|deformed)\b/i,
        'stiff_joints': /\b(stiff|tight|stuck)\s*(joint|joints)\b/i,
        'packaging_damage': /\b(box\s*damage|package\s*damage|shipping\s*damage)\b/i
    };
    
    for (const [issueType, pattern] of Object.entries(issuePatterns)) {
        if (pattern.test(text)) {
            issues.push(issueType);
        }
    }
    
    return issues;
}


function findFigureMatch(redditPost, figureList) {
    const searchText = `${redditPost.Title} ${redditPost['Text (Preview)']}`.toLowerCase();
    // Normalize hyphens in search text to match hyphen-free keywords
    const normalizedSearchText = searchText.replace(/-/g, '');
    
    let bestMatch = null;
    let bestScore = 0;
    
    for (const figure of figureList) {
        // Extract keywords from both name AND series_title
        const nameKeywords = extractKeywordsWithPriority(figure.name);
        const seriesKeywords = extractKeywordsWithPriority(figure.series_title);
        const allKeywords = [...nameKeywords, ...seriesKeywords];
        
        // Find the best matching keyword for this figure
        for (const keywordObj of allKeywords) {
            const keyword = keywordObj.text;
            
            // Skip very short keywords
            if (keyword.length < 4) continue;
            
            // Use word boundary regex with flexible matching for possessives and plurals
            // Allows "eren" to match "erens" or "eren's"
            // Test against both original and normalized search text
            const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const wordBoundaryRegex = new RegExp(`\\b${escapedKeyword}(?:'?s)?\\b`, 'i');
            
            // Try matching on both original (with hyphens) and normalized (without hyphens)
            const matchFound = wordBoundaryRegex.test(searchText) || wordBoundaryRegex.test(normalizedSearchText);
            
            if (matchFound) {
                // Calculate match score based on priority and length
                // Priority 1 (full name): base score 1000
                // Priority 2 (no parens): base score 500
                // Priority 3 (phrase): base score 300
                // Priority 4 (word): base score 100
                let score = 0;
                if (keywordObj.priority === 1) score = 1000;
                else if (keywordObj.priority === 2) score = 500;
                else if (keywordObj.priority === 3) score = 300;
                else if (keywordObj.priority === 4) score = 100;
                
                // Add length bonus (longer matches are better)
                score += keyword.length;
                
                // Phrase matches get extra bonus
                if (keywordObj.type === 'phrase') {
                    score += 50;
                }
                
                // Update best match if this score is higher
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = {
                        figureName: figure.name,
                        brand: figure.brand,
                        productLine: figure.product_line,
                        matchedKeyword: keyword,
                        matchType: keywordObj.type,
                        confidence: calculateConfidence(keywordObj.priority, keyword.length)
                    };
                }
            }
        }
    }
    
    return bestMatch;
}

function calculateConfidence(priority, keywordLength) {
    // High confidence: full name or no-parens match, or long phrases
    if (priority === 1 || priority === 2) return 'High';    //Goal: 70% accuracy. As of 3-26-2026 there was 103 reddit posts roughly 80% was fucked up and wrong
    if (priority === 3 && keywordLength >= 12) return 'High';   //hopefully that changes
    
    // Medium confidence: phrases or longer words
    if (priority === 3) return 'Medium';
    if (priority === 4 && keywordLength >= 8) return 'Medium';
    
    // Low confidence: short single words
    return 'Low';
}


function processMatching() {
    const kaiyodoData = parseCSV(KAIYODO_CSV);
    console.log(`  Kaiyodo figures: ${kaiyodoData.length}`);
    
    const sexyiceData = parseCSV(SEXYICE_CSV);
    console.log(`  SEXYiCE figures: ${sexyiceData.length}`);
    
    const allFigures = [...kaiyodoData, ...sexyiceData];
    console.log(`  Total figures: ${allFigures.length}\n`);
    
    const redditPosts = parseCSV(REDDIT_CSV);
    console.log(`  Reddit posts: ${redditPosts.length}\n`);
    
   
    const allRecords = [];
    let matchedCount = 0;
    let unmatchedCount = 0;
    
    console.log('Matching posts with figures...');
    redditPosts.forEach(post => {
        const match = findFigureMatch(post, allFigures);
        const detectedIssues = detectIssues(post);
        const issuesString = detectedIssues.join(', ');
        
        if (match) {
            matchedCount++;
            allRecords.push({
                figure_name: match.figureName,
                brand: match.brand,
                product_line: match.productLine,
                reddit_author: post.Author,
                reddit_date: post['Created Date'],
                reddit_permalink: `https://reddit.com${post.Permalink}`,
                matched_keyword: match.matchedKeyword,
                match_type: match.matchType,
                confidence: match.confidence,
                detected_issues: issuesString
            });
        } else {
            unmatchedCount++;
            allRecords.push({
                figure_name: '',  // Empty for unmatched
                brand: '',
                product_line: '',
                reddit_author: post.Author,
                reddit_date: post['Created Date'],
                reddit_permalink: `https://reddit.com${post.Permalink}`,
                matched_keyword: '',
                match_type: '',
                confidence: '',
                detected_issues: issuesString
            });
        }
    });
    
    console.log(`Matched: ${matchedCount}`);
    console.log(`Unmatched: ${unmatchedCount}\n`);
    

    const outDir = path.join(__dirname, 'name_out_file');
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }
    

    const csvWriter = createCsvWriter({     //Format for CSV
        path: OUTPUT_CSV,
        header: [
            { id: 'figure_name', title: 'figure_name' },
            { id: 'brand', title: 'brand' },
            { id: 'product_line', title: 'product_line' },
            { id: 'reddit_author', title: 'reddit_author' },
            { id: 'reddit_date', title: 'reddit_date' },
            { id: 'reddit_permalink', title: 'reddit_permalink' },
            { id: 'matched_keyword', title: 'matched_keyword' },
            { id: 'match_type', title: 'match_type' },
            { id: 'confidence', title: 'confidence' },
            { id: 'detected_issues', title: 'detected_issues' }
        ]
    });
    
    csvWriter.writeRecords(allRecords)
        .then(() => {
            console.log(`  Total Names: ${allRecords.length}`);
        })
        .catch(err => {
            console.error('Error writing CSV:', err);
        });
}
processMatching();


// posts inside posts are a bit of an issue (I think its called crossposting)
//