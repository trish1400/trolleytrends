// Define a function to perform a fetch with retry logic
async function fetchWithRetry(url, data, contentType = 'application/json', maxRetries = 3, retryDelay = 1000) {

  // Setting up the headers for Azure Blob Storage upload
  const headers = {
      'x-ms-blob-type': 'BlockBlob',
      'Content-Type': contentType // Default to 'application/json', can be overridden
  };

  // Options for the fetch request
  const options = {
      method: 'PUT', // Specify PUT method for uploading
      headers: headers,
      body: JSON.stringify(data) // Assuming the data needs to be stringified, adjust if necessary
  };

  for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
          const response = await fetch(url, options);
          if (!response.ok) {
              // If the response is not ok, log the status and throw an error
              console.error(`Server responded with status ${response.status}`);
              throw new Error('Network response was not ok');
          }
          return response; // Successfully fetched within the current attempt
      } catch (error) {
          console.error(`Attempt ${attempt + 1} failed:`, error);
          if (attempt < maxRetries - 1) {
              // Wait for retryDelay milliseconds before the next attempt
              await new Promise(resolve => setTimeout(resolve, retryDelay));
              // Increase the delay for the next attempt
              retryDelay *= 2;
          } else {
              // Rethrow the last error after all attempts have failed
              throw error;
          }
      }
  }
}


document.addEventListener('DOMContentLoaded', function () {
  const contributeButton = document.getElementById('contributeData');
  const buttonContainer = contributeButton.parentElement;

  contributeButton.addEventListener('click', function () {
    handleButtonClick();
  });

  async function handleButtonClick() {
    const contributeButton = document.getElementById('contributeData');
    const buttonContainer = contributeButton.parentElement;

    // Change button to loading state
    contributeButton.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Submitting...';
    contributeButton.disabled = true;
 
    try {
        const tescoPurchases = await getAnonPurchasesData();
        const tescoWeeklyPurchases = getAnonPurchasesByWeek(); // Synchronous, no need to await
        const tescoProducts = await getAnonProductsData();


        // Fetch the signed URL from your Cloudflare Function for each dataset
        const signedUrls = await Promise.all([
            fetchSignedUrl('tescoPurchases-' + new Date().toISOString()),
            fetchSignedUrl('tescoWeeklyPurchases-' + new Date().toISOString()),
            fetchSignedUrl('tescoProducts-' + new Date().toISOString())
        ]);

      // Use the signed URLs to upload data to Azure Blob Storage
      await Promise.all([
        fetchWithRetry(signedUrls[0], tescoPurchases),
        fetchWithRetry(signedUrls[1], tescoWeeklyPurchases),
        fetchWithRetry(signedUrls[2], tescoProducts)
      ]);

        console.log('All data uploaded successfully');

        // On success, change to "Thank you" text and show success toast
        buttonContainer.innerHTML = '<div class="fs-3 mt-2 mt-md-0">Thank you!</div>';
        showToast("<p>Data submitted successfully.</p> <p>Thank you so much!</p>", "success");
    } catch (error) {
        console.error('Error:', error);

        // On error, revert button back to initial state and show error toast
        contributeButton.innerHTML = 'Contribute!';
        contributeButton.disabled = false;
        showToast("<p>Oh no! An error occurred.</p><p> If you're willing, please raise an issue on <a href=\"https://github.com/trish1400/TrolleyTrends/issues\" target=\"_blank\" rel=\"noopener\">GitHub</a>.</p><p>Thanks for trying!</p>", "error");
    }
}

});

async function fetchSignedUrl(blobName) {
    const response = await fetch(`/generateSignedUrl?blobName=${encodeURIComponent(blobName)}`, {
      headers: { 'Accept': 'application/json' }
  });
  if (!response.ok) {
      // You might want to log or examine the response text for more insight
      throw new Error(`Failed to fetch signed URL: ${response.statusText}`);
  }
  try {
      const { signedUrl } = await response.json();
      if (signedUrl) {
          return signedUrl;
      } else {
          throw new Error('Signed URL was not provided in the response.');
      }
  } catch (error) {
      // This could catch JSON parsing errors or if the response doesn't include a signedUrl field
      console.error('Error processing response:', error);
      throw new Error('Failed to process the response.');
  }
}

