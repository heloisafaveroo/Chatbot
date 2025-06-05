// client.js
document.addEventListener('DOMContentLoaded', () => {
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const chatHistory = document.getElementById('chat-history');

    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            sendMessage();
            event.preventDefault();
        }
    });

    async function sendMessage() {
        const messageText = messageInput.value.trim();
        if (!messageText) return;

        appendMessage('user', messageText);
        messageInput.value = '';
        messageInput.focus();

        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message: messageText }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: `HTTP error! status: ${response.status}` }));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Display bot's textual response
            if (data.response) {
                appendMessage('bot', data.response);
            }

            // If weather data is present, display the weather card
            if (data.weatherData && data.weatherData.type === "weather") {
                appendWeatherCard(data.weatherData, chatHistory);
            }

        } catch (error) {
            console.error('Erro ao enviar/receber mensagem:', error);
            appendMessage('error', `Ops! Algo deu errado: ${error.message}`);
        }
    }

    function appendMessage(sender, text) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', `${sender}-message`);
        // To render newlines if Gemini sends them (it might for formatted text)
        messageDiv.innerHTML = text.replace(/\n/g, '<br>');
        chatHistory.appendChild(messageDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    // --- New Function to Add Weather Card ---
    function appendWeatherCard(weatherData, container) {
        const card = document.createElement('div');
        card.classList.add('message', 'bot-message', 'weather-card-message'); // Use bot-message for alignment

        const content = document.createElement('div');
        content.classList.add('weather-card-content');

        const title = document.createElement('h3');
        title.textContent = `Clima em ${weatherData.locationName}, ${weatherData.country}`;
        content.appendChild(title);

        if (weatherData.icon) {
            const iconImg = document.createElement('img');
            iconImg.src = `https://openweathermap.org/img/wn/${weatherData.icon}@2x.png`;
            iconImg.alt = weatherData.description;
            iconImg.classList.add('weather-icon');
            content.appendChild(iconImg);
        }

        const tempP = document.createElement('p');
        tempP.textContent = `Temperatura: ${weatherData.temperature?.toFixed(1)}°C`;
        content.appendChild(tempP);

        const descP = document.createElement('p');
        descP.textContent = `Condição: ${weatherData.description}`;
        content.appendChild(descP);

        const humidityP = document.createElement('p');
        humidityP.textContent = `Umidade: ${weatherData.humidity}%`;
        content.appendChild(humidityP);

        const windP = document.createElement('p');
        windP.textContent = `Vento: ${weatherData.windSpeed} m/s`;
        content.appendChild(windP);

        card.appendChild(content);
        container.appendChild(card);
        container.scrollTop = container.scrollHeight; // Scroll to show the new card
    }
});