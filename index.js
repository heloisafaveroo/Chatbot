import pkg from '@google/genai';
const { GoogleGenerativeAI } = pkg;
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

/**
 * Este script cria um chatbot chamado "Poeta Instantâneo" que utiliza a API Gemini
 * do Google AI para gerar poemas curtos com base nas entradas do usuário.
 */

// Configure a chave da API do Google AI Studio.
// Certifique-se de substituir "YOUR_API_KEY" pela sua chave real.
const genAI = new GoogleGenerativeAI("AIzaSyBDHRiDw5vPcLz0ZkFB9T5Q4MlErFMq_VU");

/**
 * Função assíncrona para enviar um prompt ao modelo Gemini e exibir a resposta
 * do chatbot como um poema.
 * @param {GoogleGenerativeAI.GenerativeModel} model - A instância do modelo Gemini.
 * @param {GoogleGenerativeAI.ChatSession} chat - A sessão de chat atual.
 * @param {string} prompt - A entrada do usuário para gerar o poema.
 */
async function run(model, chat, prompt) {
  try {
    const result = await chat.sendMessage(prompt);
    const response = await result.response;
    console.log("Poeta Instantâneo:", response.text());
  } catch (error) {
    console.error("Erro ao gerar resposta:", error);
  }
}

/**
 * Função assíncrona principal que configura o modelo Gemini, inicia a sessão de chat
 * e lida com a interação do usuário através do terminal.
 */
async function main() {
  // Cria uma interface de leitura para obter a entrada do usuário no terminal.
  const rl = readline.createInterface({ input, output });

  // Obtém o modelo Gemini Pro para tarefas de texto para texto.
  const model = genAI.getModel({
    model: "gemini-pro",
    // Configurações para a geração do texto.
    generationConfig: {
      stopSequences: [], // Sequências que fazem o modelo parar de gerar texto.
      maxOutputTokens: 150, // Limite máximo de tokens na resposta (para poemas curtos).
      temperature: 0.8, // Controla a aleatoriedade das respostas (valores mais altos tornam a saída mais aleatória).
      topP: 0.9, // Amostra de um conjunto menor de tokens mais prováveis.
      topK: 30, // Considera os top K tokens mais prováveis para a amostragem.
    },
    // Configurações de segurança para filtrar conteúdo potencialmente prejudicial.
    safetySettings: [
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE",
      },
      {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_MEDIUM_AND_ABOVE",
      },
      {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE",
      },
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE",
      },
    ],
  });

  // Inicia uma nova sessão de chat com um histórico inicial para definir o papel do chatbot.
  const chat = model.startChat({
    history: [
      {
        role: "user",
        parts: "Olá!",
      },
      {
        role: "model",
        parts: "Saudações, viajante das palavras! Sou o Poeta Instantâneo, pronto para transformar seus pensamentos em versos. Sobre o que você gostaria de um breve poema hoje?",
      },
    ],
    // Reaplicando as configurações de geração para a sessão de chat.
    generationConfig: {
      stopSequences: [],
      maxOutputTokens: 150,
      temperature: 0.8,
      topP: 0.9,
      topK: 30,
    },
  });

  // Exibe a mensagem inicial do chatbot para o usuário.
  console.log("Poeta Instantâneo: Saudações, viajante das palavras! Sou o Poeta Instantâneo, pronto para transformar seus pensamentos em versos. Sobre o que você gostaria de um breve poema hoje?");

  // Loop infinito para manter a conversa com o usuário até que ele decida sair.
  while (true) {
    try {
      // Aguarda a entrada do usuário no terminal.
      const userPrompt = await rl.question('Você: ');
      // Se o usuário digitar "sair", encerra a conversa.
      if (userPrompt.toLowerCase() === 'sair') {
        console.log("Poeta Instantâneo: Foi um prazer poetizar com você. Até a próxima!");
        break;
      }
      // Chama a função run para enviar a entrada do usuário e obter um poema.
      await run(model, chat, userPrompt);
    } catch (error) {
      // Em caso de erro durante a interação, exibe a mensagem de erro e encerra o loop.
      console.error("Ocorreu um erro durante a conversa:", error);
      break;
    }
  }

  // Fecha a interface de leitura do terminal.
  rl.close();
}

// Chama a função principal para iniciar o chatbot.
main();