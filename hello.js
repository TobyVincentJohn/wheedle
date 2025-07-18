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

const API_KEY = 'AIzaSyBXU-jpevHk5-pdMrloXfmnGbNhSk6wAf0'; // <-- Replace with your Gemini API key

const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${API_KEY}`;

const requestBody = {
  contents: [
    {
      parts: [
        { text: "Hello, what's the weather like on Mars?" }
      ]
    }
  ]
};

fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(requestBody)
})
  .then(response => {
    if (!response.ok) throw new Error(`HTTP error! ${response.status}`);
    return response.json();
  })
  .then(data => {
    console.log('Gemini response:', JSON.stringify(data, null, 2));
  })
  .catch(error => {
    console.error('Error:', error);
  });


