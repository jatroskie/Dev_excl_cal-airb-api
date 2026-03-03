import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://hes2-ssd-ohs.oracleindustry.com/oam/server/obrareq.cgi?encquery%3Dd%2FN4F4AqS6YfqIU702mG9AlimYqgFMM9wuuxP3qFj9%2B%2FFP7%2Bq6%2FnP4Sm33Q%2FyUtJHS5eLpAKSFLwuowBFwkzwpuHYSDz%2Bq0Dw3ApDsyMSIig3q728w%2FWw8ArbOXOPYYe%2FJGf7Kyf84R%2FEii%2BDZh5Ku%2BFyHRNBaalOyKul1imysCFtOwexMqWr87nz%2FY8yUZ1YsttkHzWMHGIvmNBl7LLwnWwL5ZrigxnKm7QjuMJCbeMdh1eJkEFbMJ93XxZvxEdfaoMAa4%2BO8FtofZ1ajH2mLhp1MyV3cq%2FTsti9co3pt6bNKpQw5KMiScIBTq4uHOAmQqCm8cnztWqCQKO2nbwv3xGFPTIn6OoVIb4deJ3DFf6E%2BMvQbXpnEAkZ2d1arVl%20agentid%3DOAM_RoyalPalm%20ver%3D1%20crmethod%3D2%26cksum%3D456cd09f1aa49f85e3f41aa4dfa0513e5e6e819a&ECID-Context=1.006BsLlZWDU03zOUuipmWH0002NB0000c8%3BkXjE');
  await page.getByRole('textbox', { name: 'User Name' }).click();
  await page.getByRole('textbox', { name: 'User Name' }).fill('johant');
  await page.getByRole('textbox', { name: 'Password' }).click();
  await page.getByRole('textbox', { name: 'Password' }).fill('Dexter123456#');
  await page.getByText('Remember Me').click();
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.getByRole('link', { name: 'Click to go to OPERA Cloud' }).click();
  const page1Promise = page.waitForEvent('popup');
  await page.goto('https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/adf.task-flow?adf.tfId=opera-cloud-index&adf.tfDoc=/WEB-INF/taskflows/opera-cloud-index.xml');
  const page1 = await page1Promise;
  await page.goto('https://mtce4.oraclehospitality.eu-frankfurt-1.ocs.oraclecloud.com/OPERA9/opera/operacloud/faces/opera-cloud-index/OperaCloud');
  await page.getByRole('link', { name: 'Bookings' }).click();
  await page.getByText('Room Diary').click();
  await page.getByLabel('View', { exact: true }).selectOption('3');
});
await page.getByLabel('View', { exact: true }).selectOption('3');