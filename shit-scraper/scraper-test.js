const cheerio = require('cheerio');

(async () =>{
    const url = 'https://example.com/';
    const response = await fetch(url);

    const $ = cheerio.load(await response.text());
    console.log($.html());

    const title=$('h1').text();
    console.log(title);
})();

// this works but it is not clean. Next thing to add is a method to turn it into a CSV or a cleaner txt file