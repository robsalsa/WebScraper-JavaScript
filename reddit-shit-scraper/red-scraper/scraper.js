const fs = require('fs');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

// File paths
const INPUT_FILE = path.join(__dirname, '..', 'raw-reddit-jsons', 'raw-3-25-2026.txt');
const OUTPUT_DIR = path.join(__dirname, 'output');
const OUTPUT_CSV = path.join(OUTPUT_DIR, 'quality-issues.csv');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'quality-issues.json');

// Keywords to search for (case insensitive)
const QUALITY_KEYWORDS = [
    // QC variations
    'qc', 'q.c', 'q/c', 'quality control', 'quality check',
    // QA variations
    'qa', 'q.a', 'q/a', 'quality assurance',
    // Broken variations
    'broken', 'broke', 'breaking', 'breaks', 'snapped', 'snap', 'cracked', 'crack',
    // Loose variations
    'loose', 'loosening', 'wobbly', 'wobble', 'floppy', 'unstable',
    // Stiff variations
    'stiff', 'tight', 'stuck', 'won\'t move', 'wont move', 'can\'t move', 'cant move',
    // General quality issues
    'defect', 'defective', 'damaged', 'damage', 'faulty', 'fault', 'issue',
    'problem', 'poor quality', 'bad quality', 'quality issue', 'manufacturing defect'
];

/**
 * Check if text contains any quality-related keywords
 */
function containsQualityKeywords(text) {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return QUALITY_KEYWORDS.some(keyword => lowerText.includes(keyword));
}

/**
 * Check if post matches quality issue criteria
 */
function isQualityIssuePost(post) {
    const data = post.data;
    
    // Check if flair is "Quality Issues"
    if (data.link_flair_text && data.link_flair_text.trim() === "Quality Issues") {
        return true;
    }
    
    // Check if title or selftext contains quality keywords
    const titleMatch = containsQualityKeywords(data.title);
    const selftextMatch = containsQualityKeywords(data.selftext);
    
    return titleMatch || selftextMatch;
}

/**
 * Extract relevant data from post
 */
function extractPostData(post) {
    const data = post.data;
    
    return {
        id: data.id,
        title: data.title || '',
        author: data.author || '',
        subreddit: data.subreddit || '',
        flair: data.link_flair_text || 'No Flair',
        score: data.score || 0,
        upvotes: data.ups || 0,
        upvote_ratio: data.upvote_ratio || 0,
        num_comments: data.num_comments || 0,
        created_utc: data.created_utc || 0,
        created_date: data.created_utc ? new Date(data.created_utc * 1000).toISOString() : '',
        selftext: (data.selftext || '').replace(/\n/g, ' ').substring(0, 500), // Limit length for CSV
        permalink: data.permalink || '',
        url: data.url || '',
        is_video: data.is_video || false,
        thumbnail: data.thumbnail || ''
    };
}

/**
 * Main scraper function
 */
function scrapeQualityIssues() {
    console.log('Starting Reddit Quality Issues Scraper...\n');
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        console.log(`Created output directory: ${OUTPUT_DIR}\n`);
    }
    
    // Read the JSON file
    console.log(`Reading file: ${INPUT_FILE}`);
    let rawData;
    try {
        const fileContent = fs.readFileSync(INPUT_FILE, 'utf-8');
        rawData = JSON.parse(fileContent);
    } catch (error) {
        console.error(`Error reading or parsing JSON file: ${error.message}`);
        return;
    }
    
    console.log(`Successfully loaded JSON data\n`);
    
    // Extract posts from the Reddit API response
    const posts = rawData.data?.children || [];
    console.log(`Total posts in file: ${posts.length}`);
    
    // Filter posts that match quality issue criteria
    const qualityIssuePosts = posts.filter(isQualityIssuePost);
    console.log(`Found ${qualityIssuePosts.length} posts with quality issues\n`);
    
    if (qualityIssuePosts.length === 0) {
        console.log('No quality issue posts found. Exiting.');
        return;
    }
    
    // Extract data from filtered posts
    const extractedData = qualityIssuePosts.map(extractPostData);
    
    // Save as JSON
    console.log(`Saving JSON to: ${OUTPUT_JSON}`);
    fs.writeFileSync(OUTPUT_JSON, JSON.stringify(extractedData, null, 2));
    console.log('JSON file saved successfully\n');
    
    // Save as CSV
    console.log(`Saving CSV to: ${OUTPUT_CSV}`);
    const csvWriter = createCsvWriter({
        path: OUTPUT_CSV,
        header: [
            { id: 'id', title: 'Post ID' },
            { id: 'title', title: 'Title' },
            { id: 'author', title: 'Author' },
            { id: 'subreddit', title: 'Subreddit' },
            { id: 'flair', title: 'Flair' },
            { id: 'score', title: 'Score' },
            { id: 'upvotes', title: 'Upvotes' },
            { id: 'upvote_ratio', title: 'Upvote Ratio' },
            { id: 'num_comments', title: 'Comments' },
            { id: 'created_date', title: 'Created Date' },
            { id: 'selftext', title: 'Text (Preview)' },
            { id: 'permalink', title: 'Permalink' },
            { id: 'url', title: 'URL' }
        ]
    });
    
    csvWriter.writeRecords(extractedData)
        .then(() => {
            console.log('CSV file saved successfully\n');
            console.log('=== Summary ===');
            console.log(`Total posts processed: ${posts.length}`);
            console.log(`Quality issue posts found: ${qualityIssuePosts.length}`);
            console.log(`Output files created:`);
            console.log(`  - ${OUTPUT_CSV}`);
            console.log(`  - ${OUTPUT_JSON}`);
        })
        .catch((error) => {
            console.error(`Error writing CSV: ${error.message}`);
        });
}

// Run the scraper
scrapeQualityIssues();
