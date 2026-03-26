
// flair file to use to find information ONLY for AY will be: https://www.reddit.com/r/AmazingYamaguchi/search.json?q=flair_name:%22Quality%20Issues%22&restrict_sr=1&limit=100&sort=new


const fs = require('fs');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

// File paths
const INPUT_DIR = path.join(__dirname, '..', 'raw-reddit-jsons', 'amazingyamaguchi');
const OUTPUT_DIR = path.join(__dirname, '..', 'output');
const OUTPUT_CSV = path.join(OUTPUT_DIR, 'ay-quality-issues.csv');
const OUTPUT_JSON = path.join(OUTPUT_DIR, 'ay-quality-issues.json');

// Checks Quality Issues flair
function hasQualityIssuesFlair(post) {
    const data = post.data;
    return data.link_flair_text && data.link_flair_text.trim() === "Quality Issues";
}

// Extracts post data fields
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

// Processes single text file
function processTextFile(filePath) {
    console.log(`\nProcessing: ${path.basename(filePath)}`);
    
    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const rawData = JSON.parse(fileContent);
        
        const posts = rawData.data?.children || [];
        console.log(`  Total posts: ${posts.length}`);
        
        const qualityIssuePosts = posts.filter(hasQualityIssuesFlair);
        console.log(`  Quality Issues flair posts: ${qualityIssuePosts.length}`);
        
        return qualityIssuePosts;
        
    } catch (error) {
        console.error(`  Error processing file: ${error.message}`);
        return [];
    }
}

// Main scraper entry point
async function scrapeQualityIssues() {
    console.log('Starting Amazing Yamaguchi Quality Issues Scraper...');
    console.log('Filtering ONLY by "Quality Issues" flair\n');
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        console.log(`Created output directory: ${OUTPUT_DIR}\n`);
    }
    
    // Get all .txt files from the amazingyamaguchi directory
    let textFiles = [];
    try {
        const files = fs.readdirSync(INPUT_DIR);
        textFiles = files
            .filter(file => file.endsWith('.txt'))
            .map(file => path.join(INPUT_DIR, file));
        
        console.log(`Found ${textFiles.length} text file(s) in ${INPUT_DIR}`);
    } catch (error) {
        console.error(`Error reading directory: ${error.message}`);
        return;
    }
    
    if (textFiles.length === 0) {
        console.log('No text files found. Exiting.');
        return;
    }
    
    // Process all text files and collect quality issue posts
    let allQualityIssuePosts = [];
    
    for (const filePath of textFiles) {
        const posts = processTextFile(filePath);
        allQualityIssuePosts = allQualityIssuePosts.concat(posts);
    }
    
    console.log(`\n=== Total Quality Issues Posts Found: ${allQualityIssuePosts.length} ===\n`);
    
    if (allQualityIssuePosts.length === 0) {
        console.log('No quality issue posts found. Exiting.');
        return;
    }
    
    // Show matched posts for verification
    console.log('=== Matched Quality Issue Posts ===');
    allQualityIssuePosts.forEach((post, index) => {
        const data = post.data;
        console.log(`${index + 1}. [Quality Issues Flair] "${data.title.substring(0, 60)}..." by ${data.author}`);
    });
    console.log('');
    
    // Extract data from filtered posts
    const extractedData = allQualityIssuePosts.map(extractPostData);
    
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
    
    await csvWriter.writeRecords(extractedData);
    console.log('CSV file saved successfully\n');
    console.log('=== Summary ===');
    console.log(`Quality issue posts found: ${allQualityIssuePosts.length}`);
    console.log(`Output files created:`);
    console.log(`  - ${OUTPUT_CSV}`);
    console.log(`  - ${OUTPUT_JSON}`);
}

// Run the scraper
scrapeQualityIssues();
