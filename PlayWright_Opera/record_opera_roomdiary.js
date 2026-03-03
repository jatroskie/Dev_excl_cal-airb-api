import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://hes2-ssd-ohs.oracleindustry.com/oam/server/obrareq.cgi?encquery%3Dhu5z7gRL1B8YOdJq4tMLq%2BrqxBOI1hEl6%2BM9EoADfKGnF1lOsYoMkeqJ1wJL5ncoHAwaBRBZCIMbwvqHdLXK0SS0rPJocpKA4hNY03LMvlAVHk7i9D4AghPj2%2F%2Bny%2FYDyRDdJf33jGMOaY7M091JOUHitRtkYbL6NswtEAqnT8QbW1RIwZYD75F%2BTkMbYbzvzxqjSuKqAnVO46Mlise1R0u5gkoGmtfr61RRSozgV4FUwoGy48ur483Pq494Zjjy%2FOnTPP9RLjUDPraSva8eTrVoEdGh5azrSb1loPXWki%2FeQsts4BQaxqNUoxj7FJ27A9xjU9RoeAzmJpzgZp8Mdk8r2hw9akSB0frXtz5kkWk70mDEl9Qrz2syUshArr%2Fs%20agentid%3DOAM_RoyalPalm%20ver%3D1%20crmethod%3D2%26cksum%3Da5f7a8c81796b6adb06b6af82658d755392f620c&ECID-Context=1.006BsP1vzlF03zOUuipmWH0002pj0001M2%3BkXjE');
  await page.getByRole('textbox', { name: 'User Name' }).click();
  await page.getByRole('textbox', { name: 'User Name' }).fill('johant');
  await page.getByRole('textbox', { name: 'Password' }).click();
  await page.getByRole('textbox', { name: 'Password' }).fill('Dexter123456#');
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.getByRole('link', { name: 'Click to go to OPERA Cloud' }).click();
  const page1Promise = page.waitForEvent('popup');
  await page.goto('https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/adf.task-flow?adf.tfId=opera-cloud-index&adf.tfDoc=/WEB-INF/taskflows/opera-cloud-index.xml');
  const page1 = await page1Promise;
  await page.goto('https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/opera-cloud-index/OperaCloud');
  await page.getByRole('link', { name: 'Bookings' }).click();
  await page.getByText('Room Diary').click();
  await page.getByPlaceholder('DD.MM.YYYY').click();
  await page.getByPlaceholder('DD.MM.YYYY').press('ArrowLeft');
  await page.getByPlaceholder('DD.MM.YYYY').press('ArrowLeft');
  await page.getByPlaceholder('DD.MM.YYYY').press('ArrowLeft');
  await page.getByPlaceholder('DD.MM.YYYY').press('ArrowLeft');
  await page.getByPlaceholder('DD.MM.YYYY').press('ArrowLeft');
  await page.getByPlaceholder('DD.MM.YYYY').press('ArrowLeft');
  await page.getByPlaceholder('DD.MM.YYYY').fill('07.03.2025');
  await page.getByRole('textbox', { name: 'Room', exact: true }).click();
  await page.getByRole('textbox', { name: 'Room', exact: true }).fill('0317');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByText('CI | Antonov, Sergei').click();
});