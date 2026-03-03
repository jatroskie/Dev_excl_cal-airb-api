import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://hes2-ssd-ohs.oracleindustry.com/oam/server/obrareq.cgi?encquery%3DPcBBo5Kltf9ZsQu0hW6UeWLieSOFlDNfG6iltdXGkXqEh0hd8k%2B4ZMjneNIYL%2BhL3gMhJVG2jhFYig8gn4gMg8BPysEkul3FU4ftXY6nNQHie7Rz2SC7F2K%2BEo3Ul95PjLFoBFnjiOB3gobJWvpP82X90lkJ2GxJrBqTG1SR1LBaXqzrkpfYjAVvW%2FqYKZ17jBPCOSMCkO%2Fk5MpLp%2BVIVcxtSXoI8QnQOKtrNNyuMe49cPfK2f%2F3ccNsxLrm%2Flah0ChPyvlZnPkYK27oOXwXK2J%2FF2GpGVG49sV60NctcMEeknFfncxA4X52xL5M0ZejMp3u1yxUxiSasf97%2BVN2kQIJW1NOtXtIkN2v0dy8Li7HbIJzfLFzVfbNfTKLz%2Bzc%20agentid%3DOAM_RoyalPalm%20ver%3D1%20crmethod%3D2%26cksum%3D68ba4d701375b73dac1d89eab166c988ef6a0566&ECID-Context=1.006BvbMLf3s03zOUuipmWH0005mn0000m9%3BkXjE');
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
});
