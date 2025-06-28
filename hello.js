// const apiKey = 'AIzaSyBXU-jpevHk5-pdMrloXfmnGbNhSk6wAf0';

// // Use query parameter for API key instead of header to avoid proxy issues
// const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`;

// const requestBody = {
//   contents: [
//     {
//       parts: [
//         {
//           text: "hi"
//         }
//       ]
//     }
//   ],

//   generationConfig: {
//     thinkingConfig: {
//       thinkingBudget: 0
//     },
//     temperature: 0.7,
//     maxOutputTokens: 2048,
//     topP: 0.8,
//     topK: 40
//   }
// };

// console.log('[GEMINI] Making API call to:', url);

// const response = await fetch(url, {
//   method: 'POST',
//   headers: {
//     'Content-Type': 'application/json',
//     'User-Agent': 'Wheedle-Game/1.0'
//   },
//   body: JSON.stringify(requestBody),
// });

// console.log(response);

// fetch('https://example.com')
//   .then(response => {
//     if (!response.ok) {
//       throw new Error(`HTTP error! Status: ${response.status}`);
//     }
//     console.log(typeof response.text())
  //   // return response.text(); // or response.json() if expecting JSON
  // })
  // .then(data => {
  //   console.log('Fetched data:', data);
  // })
  // .catch(error => {
  //   console.error('Fetch error:', error);
  // });


fetch('https://example.com')
  .then(response => response.text())
  .then(data => {
    console.log('Type of data:', typeof data); // should log: string
    console.log('First 100 chars:', data.slice(0, 100));
  })
  .catch(error => {
    console.error('Fetch error:', error);
  });

