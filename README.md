Okay here let me breakdown what this does:

1) The "Gum" Scraper and Test-Search
    - Figure Catalog (Figure Search)
        * Scraper.js 
            What the Scraper.js does is prase through a raw .txt file inside of the "/text-search" currently (3-27-2026) there is 3 files that already exist to be parsed through. Kaiyodo, Mafex(empty on purpose) , & SexyIce. In the case of Kaiyodo there is about +100 entries which all have the identifier of "FIGURE-xxxxxx". Although it does not matter if the figure number is correct or wrong its a good identifier for the script to find every individual entry that exits in the raw txt file.

            Although I do mention that the FIGURE- number does not matter. Entries that have the "FIGURE-" prefix is the indicator for the script but I recomend that for the numbers to please use all zeros ("FIGURE-00000000"). Reason for this is because the entries that do have numbers in this .txt files are all sourced from AmiAmi (Reference Link: https://www.amiami.com/eng/detail/?gcode=<insert figure number>). But obviously AmiAmi does not have a FIGURE-00000000 within its catalog so this is a good csv differentiator for "real" gcode (Figure- numbers) and entries that you the Dev write into it. For example inside of the /sexyice2019/raw.txt file there is an FIGURE-00000000 "Eliminator", this is the only entry form AmiAmi that does not have an AmiAmi number, so to remedy this issue using the zeros allows for the script to read through the file but also allow a clean entry into the CSV.

            Any entries can be added to the txt files and any folder can be added. Only caveat being that path must be /text-search/<folder name>/raw.txt. Reason for this is because the script is reading every folder inside of /text-search and within evey subfolder its looking ONLY for "raw.txt". 

            So actually running this script: 
                cd WebScraper-JavaScript\shit-scraper
                node scraper.js

            Find the csv of the figures found inside: 
                WebScraper-JavaScript\shit-scraper\out_file

            This project is open sourced so you are allowed to download CSV this script spits out.

2) The Reddit "Gum" Scraper 
    - User Testimonials (Data Collection for Fixing Figure Felix / IFigxIt)
        *  Sourcing Reddit Posts
            First of all I did not use any Reddit API nor pay for any of this information. Instead I just wrote ".json" to get the data I need. For example: "https://www.reddit.com/r/AmazingYamaguchi/.json". This is for one of the subreddit "r/AmazingYamaguchi". I think this is free... and legal... uhm... yeah anyways, this DOES NOT HAVE ALL REDDIT POSTS. 
            This leads me to the reason of why they have dates. So as of 3-27-2026 there is 4 txt files. They are all for each days of their respective subreddits. Now the point of these files are to gather a good amount of the most "NEWEST" posts on that subreddit. Note that you can change for it to be "Hottest", "New", "Most Upvotes", and whatever elese reddit filters posts with.

            Note that this is just a collection of raw posts with valuable infomation for tracing back posts to clean up. Overall it only collects releveant posts to use for the next step (CSV to SQL)

        * Ay Scraper.js 
            Now, as mentioned before this script is the most optimized for r/AmazingYamaguchi since this subreddit formats their posts a little better than most. Still hard to fully search but its fine. I kinda already explained what this script does in the previous User Testiomonials section but a brief run down is that this script looks for keywords that can be referenced with our available catalogs (Gum Scraper CSVs) and certain flairs that most likely has all the information needed. 

            To run this baby: 
                cd reddit-shit-scraper\red-scraper
                node ay_scraper.js

            Find the CSV it spits on: 
                reddit-shit-scraper\out_file

3) CSV to SQL 
    - Format and Fillin missing data
        * Name-Finding.js 
            This is a supporting script that looks through all of the Reddit posts txt files and tries its best to conneect posts to names from the catalogs.
            
             Currently the script is the most optimized for r/AmazingYamaguchi. Only data issues you much check is the fact that posts without a visable entries because most likely than not its a post without any obvious indicators (like keywords of names of figures or Quality Issue... issues) or just an image. On "Name Accuracy Notes.txt" there is more information of the percentages possible from this script. More importantly the data can reach 90%-95% accuracy after cleaning the data a little bit more but currently 67% (2/3) of the data is ready to be used for the next script.

             I have a goal to make this more for general use, like any subreddit, any type of posts. Although for now I am not there yet, since I do not use reddit enough to know any "-isms" certain redditors, subreddits, or reddit as a whole functions.

    - Reddit x Catalog Combination 
        * Data-Dresser.js
            This is simialar to the name-finding.js script but instead of just tying posts to their catalog information it now "Dresses Up" the data for easier viewing. 
            Important variables: 
                mode               //Fix (Looking for a Fix), Data (Looking to help. This one is the one is perfect for what were doing.)
                figure_name
                brand
                product_line
                series_title
                sculptor           // this might also be a bit irrelevant but idk
                scale             // currently all are 1/12
                materials
                seller           // this is a bit irrelevant and forced to be checked with amiami catalog
                age                // how old the figure is but i guess this is also unimportant
                authenticity      //hard to check live but according to amiami they are always real
                issues                         // Broken, Loose, Stiff, Other (broad issue)
                issue_description   

            


