// client.js
document.addEventListener('DOMContentLoaded', () => {
    // Get references to the HTML elements
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const chatHistory = document.getElementById('chat-history');

    // --- Event Listeners ---
    // Send message when the button is clicked
    sendButton.addEventListener('click', sendMessage);

    // Send message when Enter key is pressed in the input field
    messageInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            sendMessage();
            event.preventDefault(); // Prevent default Enter behavior (like adding a newline)
        }
    });

    // --- Core Function to Send Message ---
    async function sendMessage() {
        const messageText = messageInput.value.trim(); // Get text and remove extra whitespace

        if (!messageText) return; // Don't send empty messages

        // 1. Display user's message immediately
        appendMessage('user', messageText);

        // 2. Clear the input field
        messageInput.value = '';
        messageInput.focus(); // Keep focus on input

        // 3. Send message to the backend and handle the response
        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: messageText }), // Send as JSON
            });

            if (!response.ok) {
                // If response status is not 2xx, handle as error
                const errorData = await response.json(); // Try to get error details from backend
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json(); // Parse successful JSON response

            // 4. Display bot's response
            appendMessage('bot', data.response);

        } catch (error) {
            console.error('Erro ao enviar/receber mensagem:', error);
            // 5. Display error message in chat
            appendMessage('error', `Ops! Algo deu errado: ${error.message}`);
        }
    }

    // --- Helper Function to Add Messages to Chat History ---
    function appendMessage(sender, text) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message'); // Common class for all messages
        messageDiv.classList.add(`${sender}-message`); // Specific class (user-message, bot-message, error-message)
        messageDiv.textContent = text; // Set the text content safely

        chatHistory.appendChild(messageDiv);

        // Auto-scroll to the bottom
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }
});