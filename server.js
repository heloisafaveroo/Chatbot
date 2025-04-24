// server.js

import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import { GoogleGenerativeAI } from "@google/generative-ai"; 
import path from 'path';
import { fileURLToPath } from 'url';


const app = express();
const port = 3000; 


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



const apiKey = "AIzaSyBDHRiDw5vPcLz0ZkFB9T5Q4MlErFMq_VU"; 
if (!apiKey || apiKey === "YOUR_API_KEY_HERE" || apiKey.length < 30 ) { 
    console.warn("\n\n*********************************************************************");
    console.warn("*** ATENÇÃO: Configure sua chave de API válida do Gemini em server.js! ***");
    console.warn("O servidor funcionará, mas as chamadas para a IA falharão.");
    console.warn("Acesse https://aistudio.google.com/app/apikey para obter uma chave.");
    console.warn("*********************************************************************\n");
}

// Initialize the GoogleGenerativeAI client with the API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Get the generative model instance - UPDATED LINE
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" }); // Changed model name here

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

// Route to handle chat messages from the frontend
app.post('/chat', async (req, res) => {
  try {
    const userMessage = req.body.message;

    if (!userMessage) {
      return res.status(400).json({ error: 'Nenhuma mensagem recebida.' });
    }

    console.log("Recebido do usuário:", userMessage); // Log server-side

    // For this basic version, we don't maintain chat history server-side yet (extra challenge)
    // We send each message as a new prompt
    const result = await model.generateContent(userMessage);
    const response = await result.response; // Corrected: Access response directly from result
    const text = response.text();

    console.log("Enviando para o usuário:", text); // Log server-side
    res.json({ response: text }); // Send response back to frontend

  } catch (error) {
    console.error("Erro detalhado na rota /chat:", error); // Log the full error

    // Try to access potential response data even in errors (e.g., for blocked prompts)
    const potentialResponse = error.response; // Adjust based on actual error structure if needed
    let errorMessage = 'Erro interno ao processar a mensagem com a IA.';
    let statusCode = 500;

    // Provide more specific feedback if possible (check error message/type/structure)
    if (error.message && error.message.includes('API key not valid')) {
        errorMessage = 'Chave de API inválida ou não configurada corretamente.';
        statusCode = 401; // Unauthorized
    } else if (error.message && (error.message.includes('quota') || error.message.includes('Quota') ) ) {
        errorMessage = 'Cota da API excedida. Verifique seu plano ou limites.';
        statusCode = 429; // Too Many Requests
    } else if (potentialResponse?.promptFeedback?.blockReason) { // Check safety feedback
         errorMessage = `Mensagem bloqueada por segurança: ${potentialResponse.promptFeedback.blockReason}`;
         statusCode = 400; // Bad Request (due to content)
    } else if (error.message && error.message.includes('400 Bad Request')) { // Generic 400
        errorMessage = 'Requisição inválida. Verifique a mensagem enviada ou a configuração do modelo.';
        statusCode = 400;
    } else if (error.status === 404 || (error.message && error.message.includes('models/gemini-1.5-flash not found'))) {
        errorMessage = 'Modelo "gemini-1.5-flash" não encontrado. Verifique o nome ou a disponibilidade do modelo para sua chave.';
        statusCode = 404; // Not Found
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