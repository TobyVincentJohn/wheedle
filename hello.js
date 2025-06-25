async function fetchPage() {
  const response = await fetch('https://example.com');
  const html = await response.text();
  console.log(html);
  console.log(typeof html)
}

fetchPage();
