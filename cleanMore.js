const fs = require('fs');

let file1 = 'force-app/main/default/lwc/cpqProductDetails/cpqProductDetails.js';
let content1 = fs.readFileSync(file1, 'utf8');
content1 = content1.replace(/this\.product\?\.Category__r\?\.Name/g, 'null');
fs.writeFileSync(file1, content1);

let file2 = 'force-app/main/default/lwc/productSelectorPopup/productSelectorPopup.js';
let content2 = fs.readFileSync(file2, 'utf8');
content2 = content2.replace(/,\s*\{\s*label:\s*'Category',\s*fieldName:\s*'CategoryName',\s*type:\s*'text'\s*\}/g, '');
content2 = content2.replace(/const category = \(product\.CategoryName \|\| ''\)\.toLowerCase\(\);\s*/g, 'const category = "";\n');
content2 = content2.replace(/CategoryName: product\.Category__r \? product\.Category__r\.Name : '—',?/g, '');
fs.writeFileSync(file2, content2);
console.log('Finished secondary cleanup!');
