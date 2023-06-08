// chatbot.js
const scripts = document.getElementsByTagName("script");
const myScript = scripts[scripts.length - 1];
const queryString = myScript.src.replace(/^[^?]+\??/, "");

let style, client;

if (!queryString) {
  // do nothing
  style = "generic";
  client = "generic";
} else {
  const params = new URLSearchParams(myScript.src.split("?")[1]);
  style = params.get("style");
  client = params.get("client");
}
console.log("style: ", style);
console.log("client: ", client);

let metadata = {
  assistantName: "Assistant",
  userName: "User",
  style: style || "generic",
  client: client || "generic",
};

const userImageData = {
  url: "",
  data: "",
  type: "",
  base64: "",
};

const userDocumentData = {
  data: "",
  type: "",
  base64: "",
}

const botImageData = {
  url: "",
  data: "",
  type: "",
  base64: "",
};

// Text with HTML tags other than <a> tags with web links or <br> will be detected as HTML.
function isHtml(text) {
  return /<(?:(?:(?:a\s+(?:[^>]*?\bhref\s*=)[^>]*?|[a-z]+\s*\/?>))(?:(?!<\s*\/\s*\1\s*>)[\s\S])*<\s*\/\s*\1\s*>|[a-z][\s\S]*>|br\s*\/?\s*>)/i.test(
      text
  );
}

// Strip all <script> tags from the message
function stripScripts(inputText) {
    return inputText.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}

// Function to parse the code blocks in the message
function parseCodeMessage(message) {
  const codeBlockRegex = /```(\w+)?\n?([\s\S]*?)```/g;
  const codeBlocks = message.match(codeBlockRegex);

  if (!codeBlocks) {
    return { message: message };
  }

  let newMessage = message;
  codeBlocks.forEach((codeBlock) => {
    const [, language = "python", code] = codeBlock.match(
      /```(\w+)?\n?([\s\S]*?)```/
    );
    const codeElement = `
      <div class="code-block">
        <div class="code-block-header">
          <div class="copy-button">Copy</div>
        </div>
        <pre><code class="language-${language}">${code}</code></pre>
      </div>
    `;
    newMessage = newMessage.replace(codeBlock, codeElement);
  });
  return {
    message: newMessage,
    codeBlocks: codeBlocks,
  };
}

// Function to parse the Markdown tables in the message
function markdownToHtmlTable(markdown) {
    const tableRegex = /((\|.*\|)(?:<br>|\n)*)+/gm;
    const matches = [...markdown.matchAll(tableRegex)];

    if (!matches.length) return markdown;

    let result = markdown;
    matches.forEach((match) => {
        const rows = match[0].split(/<br>\s*|\n/).filter(row => row.trim() !== '' && !/^(\|?\s*-+\s*\|)+$/.test(row.trim()));
        let htmlTable = '<table>';

        // Header row
        htmlTable += '<tr>';
        const headerRowData = rows[0].split('|').filter((item) => item.trim() !== '');
        headerRowData.forEach((cell) => {
            htmlTable += `<th>${cell.trim()}</th>`;
        });
        htmlTable += '</tr>';

        // Data rows
        for (let i = 1; i < rows.length; i++) {
            const rowData = rows[i].split('|').filter((item) => item.trim() !== '');

            let htmlRow = '<tr>';
            rowData.forEach((cell) => {
                htmlRow += `<td>${cell.trim()}</td>`;
            });
            htmlRow += '</tr>';

            htmlTable += htmlRow;
        }

        htmlTable += '</table>';
        result = result.replace(match[0], htmlTable);
    });

    return result;
}

// Create a toggle button element for the chatbot
const toggleButton = document.createElement("button");
toggleButton.innerText = "Assistant";
toggleButton.classList.add("toggle-button");
document.body.appendChild(toggleButton);

// Create a container element for the chatbot
const chatContainer = document.createElement("div");
chatContainer.setAttribute("id", "chat-container");
chatContainer.classList.add("chat-container");
chatContainer.style.display = "none";

// Create a container element for the assets
const assetContainer = document.createElement("div");
assetContainer.setAttribute("id", "asset-container");
assetContainer.classList.add("asset-container");
assetContainer.style.display = "none"; // Initially hidden
chatContainer.appendChild(assetContainer);

// Create a message container element
const messagesContainer = document.createElement("div");
messagesContainer.setAttribute("id", "messages-container");
messagesContainer.classList.add("messages-container");
chatContainer.appendChild(messagesContainer);

// Create an input element for the user to type messages
const inputElement = document.createElement("textarea");
inputElement.classList.add("chat-input");
inputElement.setAttribute("type", "text");
inputElement.setAttribute("placeholder", "Type your message...");
chatContainer.appendChild(inputElement);

// Create an image preview element
const imagePreview = document.createElement("img");
imagePreview.classList.add("image-preview");
chatContainer.appendChild(imagePreview);

// Create a container element for the send button
const sendButtonContainer = document.createElement("div");
sendButtonContainer.classList.add("send-button-container");

// Create an input element for the user to select an image file
const imageInput = document.createElement("input");
imageInput.classList.add("image-input");
imageInput.setAttribute("type", "file");
imageInput.setAttribute("accept", "image/*");
imageInput.style.display = "none";

// Create an image upload element
const imageUploadButton = document.createElement("image-upload-button");
imageUploadButton.classList.add("image-upload-button");
imageUploadButton.innerHTML = '<img src="../images/upload_image.png" alt="Upload image" height=36>';

// Create a document element for the user to select an image file
const documentInput = document.createElement("input");
documentInput.classList.add("document-input");
documentInput.setAttribute("type", "file");
documentInput.setAttribute("accept", "image/*, application/pdf");
documentInput.style.display = "none";

// Create a document upload element
const documentUploadButton = document.createElement("document-upload-button");
documentUploadButton.classList.add("document-upload-button");
documentUploadButton.innerHTML = '<img src="../images/upload_document.png" alt="Upload document" height=36>';

// Create a button element to send messages
const sendButtonElement = document.createElement("button");
sendButtonElement.innerText = "Send";
sendButtonElement.classList.add("send-button");

// Create a voice input button element
const voiceInputButton = document.createElement("button");
voiceInputButton.classList.add("voice-input-button");
voiceInputButton.innerHTML = '<img src="../images/microphone.png" alt="Voice input" height=36>';

// Add the button elements to the send button container
sendButtonContainer.appendChild(imageInput);
sendButtonContainer.appendChild(imageUploadButton);
sendButtonContainer.appendChild(documentUploadButton);
sendButtonContainer.appendChild(sendButtonElement);
sendButtonContainer.appendChild(voiceInputButton);

// Create a container element for the clear button
const clearButtonContainer = document.createElement("div");
clearButtonContainer.classList.add("clear-button-container");

// Create a button element to clear messages
const clearButtonElement = document.createElement("button");
clearButtonElement.innerText = "Clear";
clearButtonElement.classList.add("clear-button");

// Add the clear button to the clear button container
clearButtonContainer.appendChild(clearButtonElement);

// Add a container element for the buttons and controls row
const buttonRowContainer = document.createElement("div");
buttonRowContainer.classList.add("button-row-container");
buttonRowContainer.appendChild(clearButtonContainer);
buttonRowContainer.appendChild(sendButtonContainer);

// Add button row container to the chat container
chatContainer.appendChild(buttonRowContainer);

// Create a container for the "Powered by" label
const poweredByContainer = document.createElement("div");
poweredByContainer.classList.add("powered-by-container");

// Create the "Powered by" label
const poweredByLabel = document.createElement("p");
poweredByLabel.innerText = "Powered by Conversation1st.ai";
poweredByLabel.classList.add("powered-by-label");

// Add the label to the container
poweredByContainer.appendChild(poweredByLabel);

// Add the container to the chat container
chatContainer.appendChild(poweredByContainer);

// Add the chatbot to the page
document.body.appendChild(chatContainer);

// Function to toggle the visibility of the chatbot
function toggleChatbot() {
  if (chatContainer.style.display === "none") {
    chatContainer.style.display = "flex";
    toggleButton.innerText = "Close";
  } else {
    chatContainer.style.display = "none";
    toggleButton.innerText = "Assistant";
  }
}

// Handle click event on the copy buttons
function addCopyButtonsListener() {
  const copyButtons = document.querySelectorAll(".copy-button");
  copyButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      const codeBlock = event.target.closest(".code-block");
      const code = codeBlock.querySelector("pre").innerText;
      navigator.clipboard.writeText(code);
      button.textContent = "Copied!";
      setTimeout(() => {
        button.textContent = "Copy";
      }, 3000);
    });
  });
}

// Function to add a message to the chat interface
function addMessage(message, isUserMessage, imageUrl) {
  const messageElement = document.createElement("div");
  messageElement.classList.add("chat-message");

  // Create a div for the user icon and bot icon
  const userIcon = document.createElement("div");
  userIcon.classList.add("user-message");
  userIcon.classList.add("user-icon");
  const userImage = document.createElement("img");
  const userProfilePictureUrl = sessionStorage.getItem('userProfilePictureUrl');
  if (userProfilePictureUrl && userProfilePictureUrl !== 'null') {
    userImage.src = userProfilePictureUrl;
  } else {
    userImage.src = "images/user-icon.png";
  }
  userIcon.appendChild(userImage);

  const botIcon = document.createElement("div");
  botIcon.classList.add("bot-message");
  botIcon.classList.add("bot-icon");
  const botImage = document.createElement("img");
  botImage.src = "images/bot-icon.png";
  botIcon.appendChild(botImage);

  // Create a div for the message content
  const textElement = document.createElement("div");
  if (isUserMessage) {
    textElement.classList.add("user-message");
    if (style === "business") {
      textElement.classList.add("user-message-content-business");
    } else if (style === "education") {
      textElement.classList.add("user-message-content-education");
    } else if (style === "fitness") {
      textElement.classList.add("user-message-content-fitness");
    } else if (style === "personal") {
      textElement.classList.add("user-message-content-personal");
    } else {
      textElement.classList.add("user-message-content");
    }
  } else {
    textElement.classList.add("bot-message");
    if (style === "business") {
      textElement.classList.add("bot-message-content-business");
    } else if (style === "education") {
      textElement.classList.add("bot-message-content-education");
    } else if (style === "fitness") {
      textElement.classList.add("bot-message-content-fitness");
    } else if (style === "personal") {
      textElement.classList.add("bot-message-content-personal");
    } else {
      textElement.classList.add("bot-message-content");
    }
  }
  let parsedMessage;
  if (isUserMessage) {
    parsedMessage = parseCodeMessage(stripScripts(message)).message;
  } else {
    try {
      parsedMessage = markdownToHtmlTable(parseCodeMessage(message).message);
    } catch (error) {
      console.log(error);
      parsedMessage = parseCodeMessage(message).message;
    }
  }
  if (isHtml(parsedMessage)) {
    textElement.innerHTML = parsedMessage;
    if (!isUserMessage) {
      // Find and execute script tags inside 'bot-message'
      const scriptTags = textElement.getElementsByTagName("script");
      for (let i = 0; i < scriptTags.length; i++) {
        const script = document.createElement("script");
        script.type = "text/javascript";
        if (scriptTags[i].src) {
          script.src = scriptTags[i].src;
        } else {
          script.textContent = scriptTags[i].textContent;
        }
        document.head.appendChild(script).parentNode.removeChild(script);
      }
    }
  } else {
    textElement.innerText = parsedMessage;
  }

  if (isUserMessage) {
    messageElement.classList.add("user-message");
    messageElement.appendChild(textElement);
    messageElement.appendChild(userIcon);
  } else {
    messageElement.classList.add("bot-message");
    messageElement.appendChild(botIcon);
    messageElement.appendChild(textElement);
  }

  if (imageUrl) {
    const imageDiv = document.createElement("div");
    const imageElement = document.createElement("img");
    imageElement.src = imageUrl;
    imageDiv.appendChild(imageElement);
    textElement.appendChild(imageDiv);
  }
  messagesContainer.appendChild(messageElement);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  addCopyButtonsListener();
}

// Function to send a message to the chatbot
async function sendMessage(message) {
  const userMessage = message;
  console.log(userMessage);
  // Replace the URLs in the bot message content with HTML anchor tags
  const formattedUserMessage = message.replace(
    /((?:https?:\/\/|www\.)\S+(?:[.,;:?!]+)?)/g,
    (match) => {
      if (match.startsWith("www.")) {
        return `<a href="https://${match}" target="_blank">${match}</a>`;
      } else {
        return `<a href="${match}" target="_blank">${match}</a>`;
      }
    }
  );
  // Add the user message to the chat interface
  addMessage(formattedUserMessage, true, userImageData.data);

  // Implementation of the getChatbotResponse function should be overwritten
  const botResponse = await getChatbotResponse(stripScripts(userMessage));
  console.log(botResponse);

  // Replace the URLs in the bot message content with HTML anchor tags
  const formattedBotResponse = botResponse.replace(
    /(?!(src|href)=")((?:https?:\/\/|www\.)\S+(?:[.,;:?!]+)?)(?!.*")/g,
    (match) => {
      if (match.startsWith("www.")) {
        return `<a href="https://${match}" target="_blank">${match}</a>`;
      } else {
        return `<a href="${match}" target="_blank">${match}</a>`;
      }
    }
  );
  // Add the chatbot's response to the chat interface
  if (botImageData.url) {
    // console.log("botImage.url: " + botImage.url)
    addMessage(formattedBotResponse, false, botImageData.url);
  } else {
    // console.log("botImage.data received: " + botImage.data.length + " bytes")
    addMessage(formattedBotResponse, false, botImageData.data);
  }

  // Save the chat history and session data
  saveChatHistory(messagesContainer);
  // saveSessionData();

  // Clear the image data
  userImageData.url = "";
  userImageData.data = "";
  userImageData.type = "";
  botImageData.url = "";
  botImageData.data = "";
  botImageData.type = "";
  botImageData.base64 = "";
  imageInput.value = "";

  // Clear the document data
  userDocumentData.data = "";
  userDocumentData.type = "";
  userDocumentData.base64 = "";
}

// Handle image upload
imageUploadButton.addEventListener("click", () => {
  // Simulate a click on the image input element
  imageInput.click();
});

imageInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    // Pass the data URL to the sendMessage function as the imageUrl parameter
    userImageData.data = reader.result;
    userImageData.type = userImageData.data.match(/^data:(image\/.*);base64,/)[1];
    // console.log(userImageData.type);
    // console.log(userImageData.data)
  });
  reader.onerror = (error) => console.log(error);

  if (file) {
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      imagePreview.src = event.target.result;
      imagePreview.style.display = "block";
    };
    reader.onerror = (error) => console.log(error);
  }
});

// Handle document upload
documentUploadButton.addEventListener("click", () => {
  // Simulate a click on the document input element
  documentInput.click();
});

documentInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    // Pass the data URL to the sendMessage function as the imageUrl parameter
    userDocumentData.data = reader.result;
    userDocumentData.type = file.type;
    // console.log(userDocumentData.data);
    // console.log(userDocumentData.type);
  });
  reader.onerror = (error) => console.log(error);

  if (file) {
    reader.readAsDataURL(file);
    if (file.type.startsWith('image/')) {
      reader.onload = (event) => {
        imagePreview.src = event.target.result;
        imagePreview.style.display = "block";
      };
    } else {
      imagePreview.src = "../images/documents.png";
      imagePreview.style.display = "block";
    }
    reader.onerror = (error) => console.log(error);
  }
});

// Handle paste event for user input
inputElement.addEventListener("paste", (event) => {
  const items = event.clipboardData.items;
  for (const item of items) {
    if (item.type.startsWith("image")) {
      const file = item.getAsFile();
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        // Pass the data URL to the sendMessage function as the imageUrl parameter
        userImageData.data = reader.result;
        userImageData.type = userImageData.data.match(/^data:(image\/.*);base64,/)[1];
        // console.log(userImage.type);
        // console.log(userImage.data)
      });
      reader.onerror = (error) => console.log(error);

      if (file) {
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          imagePreview.src = event.target.result;
          imagePreview.style.display = "block";
        };
        reader.onerror = (error) => console.log(error);
      }
    }
  }
});

// Add handlers for drag and drop events
function handleDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "copy";
}

async function handleDrop(event) {
  event.preventDefault();
  const file = event.dataTransfer.files[0];
  if (file) {
    if (file.type.startsWith("image")) {
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        userImageData.data = reader.result;
        userImageData.type = userImageData.data.match(/^data:(image\/.*);base64,/)[1];
        userImageData.base64 = userImageData.data.split(",")[1];
      });
      reader.onerror = (error) => console.log(error);

      reader.readAsDataURL(file);
      reader.onload = (event) => {
        imagePreview.src = event.target.result;
        imagePreview.style.display = "block";
      };
      reader.onerror = (error) => console.log(error);
    } else {
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        userDocumentData.data = reader.result;
        userDocumentData.type = file.type;
      });
      reader.onerror = (error) => console.log(error);

      reader.readAsDataURL(file);
      reader.onload = (event) => {
        imagePreview.src = "../images/documents.png";
        imagePreview.style.display = "block";
      };
      reader.onerror = (error) => console.log(error);
    }
  }
}

chatContainer.addEventListener("dragover", handleDragOver);
chatContainer.addEventListener("drop", handleDrop);


// Send a message when the user clicks the "Send" button
sendButtonElement.addEventListener("click", () => {
  const message = inputElement.value;
  inputElement.value = "";
  inputElement.style.height = "40px";
  imagePreview.src = "";
  imagePreview.style.display = "none";
  sendMessage(message).then(() => { });
});

// Handle input in the chat-input element
inputElement.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    const style = window.getComputedStyle(inputElement);
    if (event.shiftKey) {
      event.preventDefault();
      const cursorPosition = inputElement.selectionStart;
      const currentValue = inputElement.value;
      const newValue =
        currentValue.substring(0, cursorPosition) +
        "\n" +
        currentValue.substring(cursorPosition);
      inputElement.value = newValue;
      inputElement.selectionStart = inputElement.selectionEnd =
        cursorPosition + 1;
      inputElement.style.height = `${Math.min(
        inputElement.scrollHeight,
        parseInt(style.getPropertyValue("max-height"))
      )}px`;
    } else {
      event.preventDefault();
      const message = inputElement.value;
      inputElement.style.height = style.getPropertyValue("min-height");
      inputElement.value = "";
      imagePreview.src = "";
      imagePreview.style.display = "none";
      sendMessage(message).then(() => { });
    }
  }
});

// Clear the messages window and session data when user clicks the "Clear" button
clearButtonElement.addEventListener("click", () => {
  // clear the 'chatHistory' in local storage
  sessionStorage.removeItem("chatHistory");
  // clear the 'sessionData' in local storage
  sessionStorage.removeItem("sessionData");
  // clear the messages window
  messagesContainer.innerHTML = "";
});

// Toggle the chatbot when the user clicks the toggle button
toggleButton.addEventListener("click", toggleChatbot);

// Add handling of session assets
// Function to create a new asset element
function createAssetElement(filename, fileType) {
  // Create a new asset div
  const assetElement = document.createElement("div");
  assetElement.classList.add("asset-element");

  // Create a span for the filename (displaying up to 20 characters)
  const filenameElement = document.createElement("span");
  filenameElement.classList.add("asset-filename");
  filenameElement.innerText = filename.length > 20 ? filename.substring(0, 20) + '...' : filename;
  assetElement.appendChild(filenameElement);

  // Create an icon to indicate the file type
  const fileTypeIcon = document.createElement("img");
  fileTypeIcon.classList.add("file-type-icon");
  fileTypeIcon.src = "../images/" + fileType + ".png"; // Assuming you have images named after file types
  assetElement.appendChild(fileTypeIcon);

  // Create a checkbox to indicate whether the asset is selected or not
  const checkboxElement = document.createElement("input");
  checkboxElement.classList.add("asset-checkbox");
  checkboxElement.setAttribute("type", "checkbox");
  assetElement.appendChild(checkboxElement);

  // Create a delete icon
  const deleteIcon = document.createElement("img");
  deleteIcon.classList.add("delete-icon");
  deleteIcon.src = "../images/delete.png"; // Assuming you have a delete icon image
  assetElement.appendChild(deleteIcon);

  // Add the asset element to the asset container
  assetContainer.appendChild(assetElement);
}


// Implementation of the getChatbotResponse function
async function getChatbotResponse(message) {
  // Fetch the response from a chatbot server running on http://localhost:8000/chat with POST method

  let payload = {
    message: message,
    metadata: metadata,
  };
  if (userImageData.type && userImageData.data) {
    // console.log("adding image")
    payload.image = {
      type: userImageData.type,
      base64: userImageData.data.split(",")[1],
    };
  }
  if (userDocumentData.type && userDocumentData.data) {
    // console.log("adding document")
    payload.document = {
      type: userDocumentData.type,
      base64: userDocumentData.data.split(",")[1],
    };
  }
  // console.log("Payload:" + JSON.stringify(payload));
  const sessionToken = sessionStorage.getItem("sessionToken");
  const guestToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMDYiLCJ1c2VybmFtZSI6InNhYXNfZGVtb0Bwcm8tYWkub3JnIiwidXNlcl9pZCI6IjExY2JlOWU2YjgzZDRkZjU4MzhjMjYxYzk0MzEyZjJmIiwiY2xpZW50X2lkIjoiMGNkZWY4YTc0M2JhNGM0YWE4YWNlOGE3ZDQ5Njc3ODkiLCJlbWFpbCI6ImluZm9AcHJvLWFpLm9yZyIsIm5hbWUiOiJCdXNpbmVzcyBTYWFTIERlbW8iLCJpYXQiOjE2NDUyMzkwMTl9.DGmhYIT_Qs98888gJY6viKpbzcxfAq3Alkm5wItN3FU";
  let response = null;
  try {
    response = await fetch("https://conversation1st.com/api/chat", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization:
          "Bearer " + (sessionToken ? sessionToken : guestToken),
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.log(error);
    return "......";
  }
  let data = await response.json();
  // console.log("Response data: " + JSON.stringify(data));
  metadata = data.metadata;

  if (
    data.additional_data &&
    data.additional_data.images &&
    data.additional_data.images.length > 0
  ) {
    if (
      data.additional_data.images[0].type &&
      data.additional_data.images[0].type.length > 0 &&
      data.additional_data.images[0].base64 &&
      data.additional_data.images[0].base64.length > 0
    ) {
      botImageData.type = data.additional_data.images[0].type;
      botImageData.base64 = data.additional_data.images[0].base64;
      botImageData.data = "data:" + botImageData.type + ";base64," + botImageData.base64;
      // console.log("Received bot image data: " + botImage.base64.length);
    } else if (
      data.additional_data.images[0].url &&
      data.additional_data.images[0].url.length > 0
    ) {
      botImageData.url = data.additional_data.images[0].url;
      // console.log("Received bot image URL: " + botImage.url);
    }
  }

  return data.response;
}

// Initialize the IndexedDB database
function initDatabase() {
  const openRequest = indexedDB.open('chatDatabase', 1);

  openRequest.onupgradeneeded = function(event) {
    const db = event.target.result;
    db.createObjectStore('chatHistory', { keyPath: 'id' });
  };
}

// Save chat history to IndexedDB
function saveChatHistory(messagesContainer) {
  const chatHistory = messagesContainer.innerHTML;

  const openRequest = indexedDB.open('chatDatabase', 1);
  openRequest.onsuccess = function(event) {
    const db = event.target.result;
    const transaction = db.transaction('chatHistory', 'readwrite');
    const chatHistoryStore = transaction.objectStore('chatHistory');

    const chatItem = { id: 'chat', content: chatHistory };
    chatHistoryStore.put(chatItem);
  };
}

// Load chat history from IndexedDB
function restoreChatHistory() {
  const openRequest = indexedDB.open('chatDatabase', 1);
  openRequest.onsuccess = function(event) {
    const db = event.target.result;
    const transaction = db.transaction('chatHistory', 'readonly');
    const chatHistoryStore = transaction.objectStore('chatHistory');

    const getRequest = chatHistoryStore.get('chat');
    getRequest.onsuccess = function(event) {
      const chatHistory = event.target.result && event.target.result.content;
      if (chatHistory) {
        messagesContainer.innerHTML = chatHistory;
      }
    };
  };
}

// // Save chat history to local storage
// function saveChatHistory(messagesContainer) {
//   const chatHistory = messagesContainer.innerHTML;
//   sessionStorage.setItem('chatHistory', chatHistory);
// }

// // Load chat history from local storage
// function restoreChatHistory(messagesContainer) {
//   const chatHistory = sessionStorage.getItem('chatHistory');
//   if (chatHistory) {
//     messagesContainer.innerHTML = chatHistory;
//   }
// }

// eslint-disable-next-line no-unused-vars
function saveSessionData(sessionData) {
  sessionStorage.setItem('sessionData', JSON.stringify(sessionData));
}

function restoreSessionData() {
  const sessionData = sessionStorage.getItem('sessionData');
  if (sessionData) {
    return JSON.parse(sessionData);
  }
  return null;
}

// Reload the chat history when the page is reloaded
document.addEventListener('DOMContentLoaded', function () {
  const messagesContainer = document.getElementById('messages-container');
  if (messagesContainer) {
    restoreChatHistory(messagesContainer);
  }

  const sessionData = restoreSessionData();
  if (sessionData) {
    // Use the sessionData in your chatbot logic to restore the session
  }
});

// Initialize the IndexedDB database
initDatabase();
