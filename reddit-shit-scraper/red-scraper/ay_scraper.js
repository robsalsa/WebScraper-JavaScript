// flair file to use to find information ONLY for AY will be: https://www.reddit.com/r/AmazingYamaguchi/search.json?q=flair_name:%22Quality%20Issues%22&restrict_sr=1&limit=100&sort=new


const fs = require('fs');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;


const INPUT_DIR = path.join(__dirname, '..', 'raw-reddit-jsons', 'amazingyamaguchi');   //reads all files inside of the /amazingyamaguchi files
const OUTPUT_DIR = path.join(__dirname, '..', 'out_file');  
const OUTPUT_CSV = path.join(OUTPUT_DIR, 'ay-reddit-data.csv');  


function hasQualityIssuesFlair(post) {      //Specifically the flair/tag that I am looking for is the "Quality Issues" one 
    const data = post.data;
    return data.link_flair_text && data.link_flair_text.trim() === "Quality Issues";    //Although this is a limited net for other successful posts it doesnt matter this is enough (also its reliable)
}


function extractPostData(post) {      //This is just some important data points. Note that since I am basically ripping a raw json they pretty much have all these points already.
    const data = post.data;         //Note that the Ai filtered through all the actual useless json points so some things might be missing
    
    return {
        id: data.id,                    
        title: data.title || '',
        author: data.author || '',
       // subreddit: data.subreddit || '',            //Dont think I need this since its obviously the Amazing Yamaguchi one
        flair: data.link_flair_text || 'No Flair',
        //score: data.score || 0,                 //the Score... ai made redundant data
        //upvotes: data.ups || 0,               // Upvotes do not matter
        //upvote_ratio: data.upvote_ratio || 0, //upvotes do not matter part 2
       // num_comments: data.num_comments || 0, //comments although helpful for people it doesnt help for data
        created_utc: data.created_utc || 0,     //although im iffy on if the post data matters i guess its fine for others to use maybe
        created_date: data.created_utc ? new Date(data.created_utc * 1000).toISOString() : '',
        selftext: (data.selftext || '').replace(/\n/g, ' ').substring(0, 500), // Limit length for CSV //Oh it lessen the burden on CSV
        permalink: data.permalink || '',    //this is the partial link to the post we are keeping
        url: data.url || '',                //This is kinda weird but it holds not the actual url of the reddit post but instead any URL available. That being images, youtube videos, AND the actual link!
        is_video: data.is_video || false,
        thumbnail: data.thumbnail || ''
    };
}

function processTextFile(filePath) {
    console.log(`\nProcessing: ${path.basename(filePath)}`);
    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');    //set up to read the txt
        const rawData = JSON.parse(fileContent);                    //since its a json file inside of a txt there is some easy checks
        
        const posts = rawData.data?.children || [];
        console.log(`  Total posts: ${posts.length}`);
        
        const qualityIssuePosts = posts.filter(hasQualityIssuesFlair);
        console.log(`  Quality Issues flair posts: ${qualityIssuePosts.length}. Found inside of the collected posts of: ${posts.length}`);
        
        return qualityIssuePosts;
        
    } catch (error) {
        console.error(`  Error processing file: ${error.message}`);
        return [];
    }
}

async function scrapeQualityIssues() {
    // console.log('Starting Amazing Yamaguchi Quality Issues Scraper...');
    // console.log('Filtering by "Quality Issues" flair\n');

    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        console.log(`Output file path: ${OUTPUT_DIR}\n`);       //location of out file
    }
    
   
    let textFiles = []; //since this runs all txt files available it'll run through all of them
    try {
        const files = fs.readdirSync(INPUT_DIR);
        textFiles = files
            .filter(file => file.endsWith('.txt'))
            .map(file => path.join(INPUT_DIR, file));
        
        console.log(`Found ${textFiles.length} text file(s).`);
    } catch (error) {
        console.error(`Error reading directory: ${error.message}. Check if they are in the right folder!`);
        return;
    }
    
    if (textFiles.length === 0) {
        console.log('No text files found!');
        return;
    }
    
    let allQualityIssuePosts = [];
    for (const filePath of textFiles) {
        const posts = processTextFile(filePath);
        allQualityIssuePosts = allQualityIssuePosts.concat(posts);
    }
    
    
    if (allQualityIssuePosts.length === 0) {
        console.log('No quality issue posts found!');
        return;
    }
    
    
    // console.log('=== Matched Quality Issue Posts ===');  //runs through all posts found... seems dumb since the point is the output. 
    // allQualityIssuePosts.forEach((post, index) => {
    //     const data = post.data;
    //     console.log(`${index + 1}. [Quality Issues Flair] "${data.title.substring(0, 60)}..." by ${data.author}`);
    // });
    // console.log('');
    
    
    const extractedData = allQualityIssuePosts.map(extractPostData);
    
    // Save as CSV
    const csvWriter = createCsvWriter({
        path: OUTPUT_CSV,
        header: [
            { id: 'id', title: 'Post ID' },
            { id: 'title', title: 'Title' },
            { id: 'author', title: 'Author' },
            // { id: 'subreddit', title: 'Subreddit' },
            { id: 'flair', title: 'Flair' },
           // { id: 'score', title: 'Score' },
           // { id: 'upvotes', title: 'Upvotes' },
           // { id: 'upvote_ratio', title: 'Upvote Ratio' },
            // { id: 'num_comments', title: 'Comments' },
            { id: 'created_date', title: 'Created Date' },
            { id: 'selftext', title: 'Text (Preview)' },
            { id: 'permalink', title: 'Permalink' },
            { id: 'url', title: 'URL' }
        ]
    });
    
    await csvWriter.writeRecords(extractedData);
    console.log(`CSV file saved successfully\n. Out file path: ${OUTPUT_CSV}`);

    console.log(`Posts left after the filter: ${allQualityIssuePosts.length}`);
}
scrapeQualityIssues();  //repeats this process for all files.
