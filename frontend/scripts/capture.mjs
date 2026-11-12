import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const directory=new URL('../../docs/evidence/',import.meta.url);
await mkdir(directory,{recursive:true});
const browser=await chromium.launch();
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  await page.goto('http://localhost:8080');
  await page.getByText('API conectada').waitFor();
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:fileURLToPath(new URL('inicio.png',directory)),fullPage:true});
  await page.getByRole('navigation').getByRole('button',{name:'Simulación',exact:true}).click();
  await page.screenshot({path:fileURLToPath(new URL('simulacion.png',directory)),fullPage:true});
  await page.getByRole('navigation').getByRole('button',{name:'Resultados',exact:true}).click();
  await page.getByRole('button',{name:'Abrir',exact:true}).first().click();
  await page.getByRole('heading',{name:'Evolución de la cola'}).waitFor();
  await page.screenshot({path:fileURLToPath(new URL('resultados.png',directory)),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Abrir menú'}).click();
  await page.getByRole('navigation').getByRole('button',{name:'Simulación',exact:true}).click();
  await page.locator('.sidebar:not(.open)').waitFor({state:'attached'});
  await page.screenshot({path:fileURLToPath(new URL('movil.png',directory)),fullPage:true,animations:'disabled'});
  console.log('Capturas guardadas en docs/evidence/.');
} finally { await browser.close(); }
