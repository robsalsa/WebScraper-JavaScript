Set-Location $PSScriptRoot


Write-Host "Running the whole workflow"
Write-Host "Creating catalog of existing fugures"
node shit-scraper/scraper.js

Write-Host "Creating a list of all relevant reddit posts"
Write-Host "Finding things from r/amazingyamaguchi"
node reddit-shit-scraper/red-scraper/ay_scraper.js


Write-Host "Filling the blanks from reddit posts"
node csv-to-sql/name-finding.js

Write-Host "Finishing the corrected CSV"
node csv-to-sql/data-dresser.js



