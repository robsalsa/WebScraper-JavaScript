const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
const path = require('path');

// Configuration
const INPUT_FILE = path.join(__dirname, '..', 'text-search', 'kaiyodo', 'gcodes.txt');
const OUTPUT_FILE = './output/kaiyodo_products.csv';


function readTextFile(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error.message);
        return '';
    }
}

function normalizeContent(content) {
    // RemoveBOM (Byte Order Mark) if present
    content = content.replace(/^\uFEFF/, '');
    
    // Normalize line endings to \n
    content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Remove zero-width spaces and other invisible characters (but NOT tabs!)
    content = content.replace(/[\u200B-\u200D\uFEFF]/g, '');
    
    // DO NOT remove dash separators - they mark product boundaries!
    // DO NOT normalize spaces or tabs - they are part of the data structure
    
    return content;
}

function parseProducts(content) {
    const products = [];
    
    // Remove any comment lines at the start
    const lines = content.split('\n');
    const cleanLines = lines.filter(line => !line.trim().startsWith('#'));
    content = cleanLines.join('\n');
    
    // Split by lines containing only a dash (product separator)
    const sections = content.split(/\n-\n/);
    
    // Filter out empty sections
    const validSections = sections.filter(s => s.trim().length > 0);
    
    console.log(`Found ${validSections.length} product sections`);
    
    sections.forEach((section, index) => {
        // Must contain both gcode and "About this item" to be valid
        const gcodeMatch = section.match(/^FIGURE-\d+/m);
        
        // More flexible "About this item" detection - check for variations
        const aboutPattern = /about\s+this\s+item/i;
        const hasAboutSection = aboutPattern.test(section);
        
        // console.log(`\nSection ${index}:`);
        // console.log(`  First 100 chars: ${section.substring(0, 100).replace(/\n/g, '\\n')}`);
        // console.log(`  Has gcode: ${!!gcodeMatch}, gcode: ${gcodeMatch ? gcodeMatch[0] : 'none'}`);
        // console.log(`  Has "About this item": ${hasAboutSection}`);
        // console.log(`  Section length: ${section.length} chars`);
        
        // If no gcode, skip this section
        if (!gcodeMatch) {
            console.log(`  Skipping: No gcode found`);
            return;
        }
        
        // If section is too short or has no brand info, skip
        if (section.length < 50) {
            console.log(`  Skipping: Section too short`);
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
            status: ''
        };
        
        // Extract Release Date (tab-separated: "Release Date\tFeb-2023\tList Price...")
        const releaseDateMatch = section.match(/Release Date\s+([^\t\n]+)/i);
        if (releaseDateMatch) product.releaseDate = releaseDateMatch[1].trim();
        
        // Extract Brand (line: "Brand\tKaiyodo")
        const brandMatch = section.match(/Brand\s+(.+?)(?:\n|$)/i);
        if (brandMatch) product.brand = brandMatch[1].trim();
        // console.log(`  Brand found: ${product.brand || 'none'}`);
        
        // Extract Product Line (may have no spaces between words)
        const productLineMatch = section.match(/Product Line\s+(.+?)(?:\n|$)/i);
        if (productLineMatch) product.productLine = productLineMatch[1].trim();
        
        // Extract Series Title
        const seriesTitleMatch = section.match(/Series Title\s+(.+?)(?:\n|$)/i);
        if (seriesTitleMatch) product.seriesTitle = seriesTitleMatch[1].trim();
        
        // Extract Character Name (this becomes the product name)
        const characterMatch = section.match(/Character Name\s+(.+?)(?:\n|Sculptor|$)/i);
        if (characterMatch) product.name = characterMatch[1].trim();
        
        // Extract Sculptor (format: "Sculptor\tKatsuhisa Yamaguchi")
        const sculptorMatch = section.match(/Sculptor\s+(.+?)(?:\s*\n|$)/i);
        if (sculptorMatch) product.sculptor = sculptorMatch[1].trim();
        
        // Extract full Specifications section (everything after "Specifications" until "[Set Contents]")
        const specMatch = section.match(/Specifications\s+(.+?)(?=\[Set Contents\]|Details|Copyright|FIGURE-\d+|$)/is);
        if (specMatch) {
            product.spec = specMatch[1].trim();
            
            // Extract Material from within specifications
            const materialMatch = product.spec.match(/Material:\s*(.+?)(?:\n|$)/i);
            if (materialMatch) {
                product.material = materialMatch[1].trim();
            }
        }
        
        // Status field not present in clean format
        product.status = '';
        
        products.push(product);
        // console.log(`  Product added: ${product.gcode}`);
    });
    
    console.log(`\nTotal products before filter: ${products.length}`);
    const filtered = products.filter(p => p.gcode && p.brand);
    console.log(`Total products after filter: ${filtered.length}`);
    
    return filtered; // Only return valid products
}

async function saveToCSV(products) {
    if (products.length === 0) {
        console.log('\n⚠ No products to save');
        return;
    }

    // Create output directory if it doesn't exist
    const outputDir = './output';
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const csvWriter = createCsvWriter({
        path: OUTPUT_FILE,
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
            { id: 'status', title: 'status' }
        ]
    });

    // Write ALL products at once
    await csvWriter.writeRecords(products);
    console.log(`\n✓ CSV file saved: ${OUTPUT_FILE}`);
    console.log(`✓ Total products written: ${products.length}`);
}


(async () => {
    try {
        // console.log('=== AmiAmi Text File Product Parser ===\n');

        // Step 1: Read text file
        console.log(`Reading data from: ${INPUT_FILE}\n`);
        
        if (!fs.existsSync(INPUT_FILE)) {
            throw new Error(`File not found: ${INPUT_FILE}\n\nPlease create the file and paste product information from AmiAmi.`);
        }

        const content = readTextFile(INPUT_FILE);

        if (!content) {
            throw new Error('File is empty or could not be read.');
        }

        console.log('✓ File loaded successfully\n');
        
        // Normalize content to handle encoding issues, spaces, etc.
        const normalizedContent = normalizeContent(content);
        console.log('✓ Content normalized\n');
        
        console.log('Parsing product information...\n');

        // Step 2: Parse products from content
        const products = parseProducts(normalizedContent);

        if (products.length === 0) {
            throw new Error('No products found in file. Please check the format.');
        }

        console.log(`✓ Found ${products.length} product(s)\n`);
        
        // Display extracted products
        // console.log('=== Extracted Products ===');
        // products.forEach((product, index) => {
        //     console.log(`\n${index + 1}. ${product.gcode}`);
        //     console.log(`   Name: ${product.name || '(not found)'}`);
        //     console.log(`   Brand: ${product.brand}`);
        //     console.log(`   Release: ${product.releaseDate}`);
        //     console.log(`   Status: ${product.status}`);
        // });

        // Step 3: Save ALL products to a SINGLE CSV file
        console.log('\n\nWriting to CSV...');
        await saveToCSV(products);

        // // Display summary
        // console.log('\n=== Summary ===');
        // console.log(`Total products parsed: ${products.length}`);
        // console.log('\n✓ Parsing completed successfully!');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    }
})();

// Stopped at page 5 from 7 (Note i started from 7 and should end at page 1)