const fs = require('fs');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const KAIYODO_CSV = path.join(__dirname, '..', 'shit-scraper', 'out_file', 'kaiyodo', 'kaiyodo_AY.csv');
// const SEXYICE_CSV = path.join(__dirname, '..', 'shit-scraper', 'out_file', 'sexyice', 'sexyice.csv');
const REDDIT_MATCHES_CSV = path.join(__dirname, 'name_out_file', 'reddit-figures-names.csv');


const today = new Date();   //"todays" date for out files
const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
const OUTPUT_CSV = path.join(__dirname, 'out_file', `combined-data-${dateStr}.csv`);


function parseCSV(filePath) {   //converting the CSV to an array to filter with - handles multi-line quoted fields
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


function parseCSVLine(line) {   //this functions replaces all "" into '' so it doesnt confuse it with a command
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


function extractScale(spec) {       //turns any heights it mentions into 1/12 (luckily i think all figures I have in the files are 1/12) but it'll still give it an appropriate scale 
    if (!spec) return null;
    const scaleMatch = spec.match(/Scale:\s*(1\/\d+|\d+:\d+|[^\n]+)/i);
    return scaleMatch ? scaleMatch[1].trim() : null;
}


function cleanText(text) {  //Defaulted missing data Unknown to return null 
    if (!text || text === 'UNKNOWN' || text === 'unknown' || text === '') return null;
    return text.trim().replace(/^"|"$/g, '');
}


function validateRecord(record, index) {
    // Validate a single record before insertion
    const errors = [];
    
    if (!record.figure_name) errors.push(`Row ${index}: Missing figure_name`);
    if (!record.brand) errors.push(`Row ${index}: Missing brand`);
    if (!['fix', 'data'].includes(record.mode)) errors.push(`Row ${index}: Invalid mode (must be 'fix' or 'data')`);
    
    // Validate JSONB issues field
    if (record.issues) {
        try {
            const parsed = JSON.parse(record.issues);
            if (!Array.isArray(parsed)) {
                errors.push(`Row ${index}: issues must be a JSON array`);
            }
        } catch (e) {
            errors.push(`Row ${index}: Invalid JSON in issues field`);
        }
    }
    
    return errors;
}


function validateAllRecords(records) {
    const allErrors = [];
    
    records.forEach((record, index) => {
        const errors = validateRecord(record, index + 1);
        allErrors.push(...errors);
    });
    
    if (allErrors.length > 0) {
        console.log(`  *!* Found ${allErrors.length} validation errors:`);
        allErrors.slice(0, 10).forEach(err => console.log(`    - ${err}`));
        if (allErrors.length > 10) {
            console.log(`    ... and ${allErrors.length - 10} more errors`);
        }
        console.log('');
        return false;
    }
    
    console.log('  All records passed the smell test\n');
    return true;
}


function calculateAge(releaseDate) {
    if (!releaseDate || releaseDate === 'UNKNOWN') return 'Unknown';
    
    // Parse various date formats (e.g., "Jan-2025", "late Feb-2018", "mid May-2018")
    const dateStr = releaseDate.toLowerCase();
    const currentYear = new Date().getFullYear();
    
    // Extract year
    const yearMatch = dateStr.match(/\d{4}/);
    if (!yearMatch) return 'Unknown';
    
    const year = parseInt(yearMatch[0]);
    const yearsDiff = currentYear - year;
    
    if (yearsDiff === 0) return 'New';
    if (yearsDiff === 1) return '1 Year';
    if (yearsDiff > 1) return `${yearsDiff} Years`;
    
    return 'Pre-order';
}


function mapProductToSchema(product, seller) {      //graph data into their correct sections.
    return {
        mode: 'data',
        figure_name: cleanText(product.name),
        brand: cleanText(product.brand),
        product_line: cleanText(product.product_line),
        series_title: cleanText(product.series_title),
        sculptor: cleanText(product.sculptor),
        scale: extractScale(product.spec),
        materials: cleanText(product.material),
        seller: seller,
        age: calculateAge(product.release_date),
        authenticity: 'true', // Official AmiAmi listings are authentic
        issues: '[]', // Empty JSON array for clean data (will be populated by mergeRedditIssues)
        issue_description: null
    };
}


async function processData() {    
            // STEP 1: Load Reddit matches (source of truth - only figures with testimonials)
    console.log('Loading Reddit posts...'); 
    if (!fs.existsSync(REDDIT_MATCHES_CSV)) {
        console.log('  *!* Reddit matches file not found!');
        console.log('  Run name-finding.js first to generate reddit-figures-names.csv *!*\n');
        process.exit(1);
    }
    
    const redditMatches = parseCSV(REDDIT_MATCHES_CSV);
    console.log(`  Total Reddit posts: ${redditMatches.length}`);
    
        // Filter out unmatched posts (empty figure_name)
    const matchedPosts = redditMatches.filter(match => match.figure_name && match.brand);
    console.log(`  Matched to figures: ${matchedPosts.length}\n`);
    
    if (matchedPosts.length === 0) {
        console.log('  *!* No matched figures found. Nothing to process. *!*\n');
        process.exit(0);
    }
    
        // STEP 2: Load figure catalog for reference details
    console.log('Loading figure catalog...');
    const kaiyodoData = parseCSV(KAIYODO_CSV);
    console.log(`  Kaiyodo figures: ${kaiyodoData.length}`);
    // const sexyiceData = parseCSV(SEXYICE_CSV);
    // console.log(`  SEXYiCE figures: ${sexyiceData.length}`);
    const allFigures = [...kaiyodoData]; // , ...sexyiceData
    console.log('');
    
    // Create lookup map: figure_name + brand -> full catalog data
    const figureMap = new Map();
    allFigures.forEach(figure => {
        const key = `${figure.name}_${figure.brand}`.toLowerCase();
        figureMap.set(key, figure);
    });
    
        // STEP 3: Process each Reddit post individually (no grouping by figure)
    console.log('Looking up posts to match it with Kaiyodo catalog...');
    let allRecords = [];
    let foundInCatalog = 0;
    let missingFromCatalog = 0;
    
    matchedPosts.forEach(match => {
        const key = `${match.figure_name}_${match.brand}`.toLowerCase();
        
        // Try to find full details from catalog
        const catalogFigure = figureMap.get(key);
        
        let record;
        if (catalogFigure) {
            // Full details available - use catalog data
            record = mapProductToSchema(catalogFigure, 'AmiAmi');
            foundInCatalog++;
        } else {
            // Not in catalog - create minimal record from Reddit data
            record = {
                mode: 'data',
                figure_name: match.figure_name,
                brand: match.brand,
                product_line: match.product_line,
                series_title: null,
                sculptor: null,
                scale: null,
                materials: null,
                seller: null,
                age: 'Unknown',
                authenticity: 'true',
                issues: '[]',
                issue_description: null
            };
            missingFromCatalog++;
        }
        
        // Add THIS post's issue data (not aggregated)
        const issues = [];
        if (match.detected_issues && match.detected_issues.trim()) {
            const detectedIssues = match.detected_issues.split(',').map(i => i.trim()).filter(i => i);
            issues.push(...detectedIssues);
        }
        record.issues = JSON.stringify(issues);
        
        // Add THIS post's permalink
        record.issue_description = match.reddit_permalink 
            ? `Reddit report: ${match.reddit_permalink}`
            : null;
        
        allRecords.push(record);
    });
    
    console.log(`  Matches found in catalog: ${foundInCatalog}`);
    if (missingFromCatalog > 0) {
        console.log(`  *!* Missing from catalog: ${missingFromCatalog} (using Reddit data only)`);
    }
    
    // Validate records
    const isValid = validateAllRecords(allRecords);
    if (!isValid) {
        console.log('*!* Validation failed. Review errors above. *!*\n');
    }
    
    // Write to CSV    
    const outDir = path.dirname(OUTPUT_CSV);
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }
    
    const csvWriter = createCsvWriter({
        path: OUTPUT_CSV,
        header: [
            { id: 'mode', title: 'mode' },
            { id: 'figure_name', title: 'figure_name' },
            { id: 'brand', title: 'brand' },
            { id: 'product_line', title: 'product_line' },
            { id: 'series_title', title: 'series_title' },
            { id: 'sculptor', title: 'sculptor' },
            { id: 'scale', title: 'scale' },
            { id: 'materials', title: 'materials' },
            { id: 'seller', title: 'seller' },
            { id: 'age', title: 'age' },
            { id: 'authenticity', title: 'authenticity' },
            { id: 'issues', title: 'issues' },
            { id: 'issue_description', title: 'issue_description' }
        ]
    });
    
    csvWriter.writeRecords(allRecords)
        .then(() => {
            console.log(`CSV saved: ${OUTPUT_CSV}`);
            console.log(`Total records: ${allRecords.length}\n`);
        })
        .catch(err => {
            console.error('❌ Error writing CSV:', err);
        });
}

processData();
