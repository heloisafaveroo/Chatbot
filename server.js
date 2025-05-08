// server.js
import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import { GoogleGenerativeAI } from "@google/generative-ai";
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios'; // Importe o axios

const tools = [
  {
    functionDeclarations: [
      {
        name: "getCurrentTime",
        description: "Obtém a data e hora atuais.",
        parameters: { type: "object", properties: {} } // Sem parâmetros necessários
      },
      {
        name: "getCurrentWeather",
        description: "Obtém o clima atual para uma localização.",
        parameters: {
          type: "object",
          properties: {
            location: {
              type: "string",
              description: "A localização para obter o clima (ex: 'Assis Chateaubriand, BR')",
            },
          },
          required: ["location"],
        },
      },
      // Adicione outras declarações de função aqui depois (se desejar adicionar mais funções no futuro)
    ]
  }
];

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey || apiKey === "YOUR_API_KEY_HERE" || apiKey.length < 30 ) {
    console.warn("\n\n*********************************************************************");
    console.warn("*** ATENÇÃO: Configure sua chave de API válida do Gemini em server.js! ***");
    console.warn("O servidor funcionará, mas as chamadas para a IA falharão.");
    console.warn("Acesse https://aistudio.google.com/app/apikey para obter uma chave.");
    console.warn("*********************************************************************\n");
}

// Initialize the GoogleGenerativeAI client with the API key
const genAI = new GoogleGenerativeAI(apiKey);

// Get the generative model instance - agora passando as 'tools' na inicialização
const model = genAI.getGenerativeModel({
  model: "gemini-pro", // Ou o modelo que suporta function calling
  tools: tools, // Passa as ferramentas aqui!
  // ... suas outras configs (safetySettings, etc.)
});

const app = express();
const port = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Middleware ---
// Parse JSON bodies (for receiving messages from the frontend)
app.use(express.json());
// Serve static files (HTML, CSS, client-side JS) from the current directory
app.use(express.static(__dirname));

// --- Routes ---
// Route to serve the main HTML page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Função para obter a hora atual para uma localização (usando uma API externa)
async function getCurrentTime() {
    try {
        const response = await axios.get(`https://worldtimeapi.org/api/timezone/America/Sao_Paulo`); // Usando São Paulo como referência para o Paraná
        return `A hora atual em Assis Chateaubriand é: ${new Date(response.data.datetime).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })} (Horário de Brasília).`;
    } catch (error) {
        console.error("Erro ao obter a hora:", error);
        return "Não foi possível obter a hora atual.";
    }
}

// Função para obter o clima atual para uma localização (usando uma API externa)
async function getCurrentWeather(location) {
    try {
        // Substitua pela sua chave de API do OpenWeatherMap ou outra API de clima
        const apiKeyWeather = process.env.OPENWEATHERMAP_API_KEY || 'SUA_CHAVE_DO_OPENWEATHERMAP';
        const [city, countryCode] = location.split(',').map(item => item.trim());
        const apiUrl = `https://api.openweathermap.org/data/2.5/weather?q=${city},${countryCode}&appid=${apiKeyWeather}&units=metric&lang=pt_br`;
        const response = await axios.get(apiUrl);
        const weatherData = response.data;
        return `O clima em ${location} é: ${weatherData.weather[0].description}. Temperatura: ${weatherData.main.temp}°C. Umidade: ${weatherData.main.humidity}%. Vento: ${weatherData.wind.speed} m/s.`;
    } catch (error) {
        console.error("Erro ao obter o clima:", error);
        return `Não foi possível obter o clima para ${location}.`;
    }
}

// Route to handle chat messages from the frontend
app.post('/chat', async (req, res) => {
    try {
        const userMessage = req.body.message;

        if (!userMessage) {
            return res.status(400).json({ error: 'Nenhuma mensagem recebida.' });
        }

        console.log("Recebido do usuário:", userMessage); // Log server-side

        const result = await model.generateContent(userMessage);
        const response = await result.response;

        if (response.promptFeedback?.blockReason) {
            return res.status(400).json({ error: `Mensagem bloqueada por segurança: ${response.promptFeedback.blockReason}` });
        }

        if (response.candidates && response.candidates.length > 0 && response.candidates[0].content.parts[0]?.functionCall) {
            // A API Gemini quer que você execute uma função
            const functionCall = response.candidates[0].content.parts[0].functionCall;
            const functionName = functionCall.name;
            const functionArgs = functionCall.args;

            console.log("Chamada de função detectada:", functionName, functionArgs);

            let functionResult;
            if (functionName === "getCurrentTime") {
                functionResult = await getCurrentTime();
            } else if (functionName === "getCurrentWeather") {
                functionResult = await getCurrentWeather(functionArgs.location);
            } else {
                functionResult = "Função desconhecida.";
            }

            // Envie o resultado da função de volta para o modelo para obter a resposta final
            const resultWithFunctionResponse = await model.generateContent([
                userMessage,
                {
                    role: "model",
                    parts: [{ functionCall }],
                },
                {
                    role: "function",
                    name: functionName,
                    content: JSON.stringify({ result: functionResult }),
                },
            ]);

            const finalResponse = await resultWithFunctionResponse.response;
            botResponse = finalResponse.text();

        } else {
            // Resposta normal do modelo
            botResponse = response.text();
        }

        console.log("Enviando para o usuário:", botResponse); // Log server-side
        res.json({ response: botResponse }); // Send response back to frontend

    } catch (error) {
        console.error("Erro detalhado na rota /chat:", error); // Log the full error

        const potentialResponse = error.response;
        let errorMessage = 'Erro interno ao processar a mensagem.';
        let statusCode = 500;

        if (error.message && error.message.includes('API key not valid')) {
            errorMessage = 'Chave de API inválida ou não configurada corretamente.';
            statusCode = 401;
        } else if (error.message && (error.message.includes('quota') || error.message.includes('Quota') ) ) {
            errorMessage = 'Cota da API excedida. Verifique seu plano ou limites.';
            statusCode = 429;
        } else if (potentialResponse?.promptFeedback?.blockReason) {
            errorMessage = `Mensagem bloqueada por segurança: ${potentialResponse.promptFeedback.blockReason}`;
            statusCode = 400;
        } else if (error.message && error.message.includes('400 Bad Request')) {
            errorMessage = 'Requisição inválida. Verifique a mensagem enviada ou a configuração do modelo.';
            statusCode = 400;
        } else if (error.status === 404 || (error.message && error.message.includes('models/gemini-1.5-flash not found'))) {
            errorMessage = 'Modelo "gemini-1.5-flash" não encontrado. Verifique o nome ou a disponibilidade do modelo para sua chave.';
            statusCode = 404;
        }

        res.status(statusCode).json({ error: errorMessage });
    }
});

// --- Start Server ---
app.listen(port, () => {
    console.log(`\n🤖 Servidor Mestre dos Bots rodando em http://localhost:${port}`);
    console.log(`Acesse a aplicação no seu navegador.`);
    console.log(`Para parar o servidor, pressione Ctrl+C.`);
});