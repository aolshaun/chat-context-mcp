import { chromium } from 'playwright';

async function testPlaywright() {
  console.log('Testing Playwright - Browser will open visibly...');
  
  try {
    const browser = await chromium.launch({ 
      headless: false,
      slowMo: 500 // Slow down operations so you can see them
    });
    console.log('✓ Browser launched');
    
    const context = await browser.newContext();
    const page = await context.newPage();
    console.log('✓ Page created');
    
    await page.goto('https://example.com');
    console.log('✓ Navigated to example.com');
    
    const title = await page.title();
    console.log(`✓ Page title: "${title}"`);
    
    // Wait a bit so you can see it
    await page.waitForTimeout(3000);
    
    await browser.close();
    console.log('✓ Browser closed');
    
    console.log('\n✅ Playwright is working correctly!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testPlaywright();

