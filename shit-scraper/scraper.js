const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
const path = require('path');

const TEXT_SEARCH_DIR = path.join(__dirname, '..', 'text-search');
const OUTPUT_BASE_DIR = path.join(__dirname, 'out_file');
const JPY_TO_USD = 0.0069; // Conversion rate from JYP to USD (Date for this conversion: 3/25/2026)


function discoverFilePairs() {
    const filePairs = [];
    
    if (!fs.existsSync(TEXT_SEARCH_DIR)) {
        console.log('*!* text-search directory not found *!*');
        return filePairs;
    }

    const subdirs = fs.readdirSync(TEXT_SEARCH_DIR, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

    console.log(`Found ${subdirs.length} subdirectories in text-search/`);

    subdirs.forEach(subdir => {
        const inputFile = path.join(TEXT_SEARCH_DIR, subdir, 'raw.txt');
        
        if (fs.existsSync(inputFile)) {
            const outputFile = path.join(OUTPUT_BASE_DIR, subdir, `${subdir}.csv`);
            filePairs.push({ 
                input: inputFile, 
                output: outputFile, 
                name: subdir 
            });
            console.log(`  ✓ Found: ${subdir}/raw.txt`);
        } else {
            console.log(`  - Skipped: ${subdir}/ (no raw.txt found)`);
        }
    });

    return filePairs;
}


function readTextFile(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error.message);
        return '';
    }
}

function normalizeContent(content) {
    content = content.replace(/^\uFEFF/, '');   //kill Byte Order Marks (something inside of txt files)
    content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');  //kill \n and empty lines
    content = content.replace(/[\u200B-\u200D\uFEFF]/g, '');    //kill any invisable characters

    return content;
}

function parseProducts(content) {
    const products = [];

    const lines = content.split('\n');
    const cleanLines = lines.filter(line => !line.trim().startsWith('#'));  //kill lines starting with # (Example: #Page x of y)
    content = cleanLines.join('\n');

    const sections = content.split(/\n-\n/);    //seperate entries by dashes ('-')
    const validSections = sections.filter(s => s.trim().length > 0);

    console.log(`Found ${validSections.length} entry sections`);  //kill empty lines

    sections.forEach((section, index) => {
        const gcodeMatch = section.match(/^FIGURE-\d+/mi);  //find the figure-xxxxx code from AmiAmi
        const aboutPattern = /about\s+this\s+item/i;    //find section "About this item" AmiAmi has for all listings
        const hasAboutSection = aboutPattern.test(section);

        if (!gcodeMatch) {
            console.log(`  Skipping: No AmiAmi gcode found!!! Entry ${index - 1}`);
            return;
        }

        if (section.length < 50) {
            console.log(`  Skipping: This are missing!! Entry ${index - 1}`);
            return;
        }

        const gcode = gcodeMatch[0].trim();

        const product = {
            gcode: gcode,
            name: '',
            brand: '',
            productLine: '',
            seriesTitle: '',
            releaseDate: '',
            sculptor: '',
            material: '',
            spec: '',
            status: '',
            priceJPY: '',
            priceUSD: ''
        };

        const releaseDateMatch = section.match(/Release Date\s+([^\t\n]+)/i);   //find Release Date
        if (releaseDateMatch) product.releaseDate = releaseDateMatch[1].trim();

        const brandMatch = section.match(/Brand\s+(.+?)(?:\n|$)/i);     //find Brand 
        if (brandMatch) product.brand = brandMatch[1].trim();

        const productLineMatch = section.match(/Product Line\s+(.+?)(?:\n|$)/i);    //find Product Line
        if (productLineMatch) product.productLine = productLineMatch[1].trim();

        const seriesTitleMatch = section.match(/Series Title\s+(.+?)(?:\n|$)/i);    //find Series
        if (seriesTitleMatch) product.seriesTitle = seriesTitleMatch[1].trim();

        const characterMatch = section.match(/Character Name\s+(.+?)(?:\n|Sculptor|$)/i); //find Character Name
        if (characterMatch) product.name = characterMatch[1].trim();

        const sculptorMatch = section.match(/Sculptor\s+(.+?)(?:\s*\n|$)/i);    //Find Sculptor
        if (sculptorMatch) product.sculptor = sculptorMatch[1].trim();

        const priceMatch = section.match(/(?:List Price|Price)[:\s]+¥?([\d,]+)/i); //find price in JPY
        if (priceMatch) {
            const jpyPrice = parseInt(priceMatch[1].replace(/,/g, ''));
            product.priceJPY = jpyPrice.toString();
            product.priceUSD = (jpyPrice * JPY_TO_USD).toFixed(2);
        }

        const specMatch = section.match(/Specifications\s+(.+?)(?=\[Set Contents\]|Details|Copyright|FIGURE-\d+|$)/is); //find All info about specs
        if (specMatch) {
            product.spec = specMatch[1].trim();

            const materialMatch = product.spec.match(/Material:\s*(.+?)(?:\n|$)/i); //find materials listed. Example: PVC, Cloth, or whatever
            if (materialMatch) {
                product.material = materialMatch[1].trim();
            }
        }

        product.status = '';
        products.push(product);
    });

    console.log(`Total entries found before filtering out for new info: ${products.length}`);
    const filtered = products.filter(p => p.gcode && p.brand);
    console.log(`Total entries left after checking out for new info: ${filtered.length}`);

    return filtered;
}

async function saveToCSV(products, outputFile) {
    if (products.length === 0) {
        console.log('\n*!* No entries to saved *!*');
        return;
    }

    const outputDir = path.dirname(outputFile);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const csvWriter = createCsvWriter({
        path: outputFile,
        header: [
            { id: 'gcode', title: 'gcode' },
            { id: 'name', title: 'name' },
            { id: 'brand', title: 'brand' },
            { id: 'productLine', title: 'product_line' },
            { id: 'seriesTitle', title: 'series_title' },
            { id: 'releaseDate', title: 'release_date' },
            { id: 'sculptor', title: 'sculptor' },
            { id: 'material', title: 'material' },
            { id: 'spec', title: 'spec' },
            { id: 'status', title: 'status' },
            { id: 'priceJPY', title: 'price_jpy' },
            { id: 'priceUSD', title: 'price_usd' }
        ]
    });

    await csvWriter.writeRecords(products);
    console.log(`CSV entries saved: ${outputFile}`);
    console.log(`Total entries written: ${products.length}\n`);
}

async function processFile(inputFile, outputFile, sourceName) {
    console.log(`\nParsing: ${sourceName}`);
    
    if (!fs.existsSync(inputFile)) {
        console.log(`*!* File not found, skipping: ${inputFile} *!*`);
        return;
    }

    const content = readTextFile(inputFile);
    
    if (!content) {
        console.log('*!* File is empty or could not be read, skipping. *!*');
        return;
    }
    
    const normalizedContent = normalizeContent(content);
    const products = parseProducts(normalizedContent);

    if (products.length === 0) {
        console.log('*!* No entries found in file. *!*');
        return;
    }

    await saveToCSV(products, outputFile);
}


(async () => {
    try {        
        // Automatically discover all text files to process
        const filePairs = discoverFilePairs();

        if (filePairs.length === 0) {
            console.log('\n*!* No raw.txt files found to process *!*');
            return;
        }

        console.log(`\nFound ${filePairs.length} file(s)\n`);
        
        // Process each discovered file
        for (const pair of filePairs) {
            await processFile(pair.input, pair.output, pair.name);
        }
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    }
})();

