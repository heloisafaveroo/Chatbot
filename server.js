import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import { GoogleGenerativeAI } from "@google/generative-ai";
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import cors from 'cors';



const app = express();
const port = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configurações do Gemini AI
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey || apiKey === "YOUR_API_KEY_HERE" || apiKey.length < 30) {
    console.warn("\n\n*** ATENÇÃO: Configure sua chave de API do Gemini! ***");
}
const openWeatherMapApiKey = process.env.OPENWEATHERMAP_API_KEY;
if (!openWeatherMapApiKey || openWeatherMapApiKey === "SUA_CHAVE_DO_OPENWEATHERMAP" || openWeatherMapApiKey.length < 20) {
    console.warn("\n\n*** ATENÇÃO: Configure sua chave de API do OpenWeatherMap no arquivo .env! ***");
}


const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    tools: [
        {
            functionDeclarations: [
                {
                    name: "getCurrentTime",
                    description: "Obtém a data e hora atuais. Opcionalmente, pode receber um fuso horário específico (ex: 'America/Sao_Paulo', 'Europe/London'). A função retorna campos 'date' (data formatada), 'time' (hora formatada) e 'formatted' (data e hora completas).",
                    parameters: {
                        type: "object",
                        properties: {
                            timezone: {
                                type: "string",
                                description: "O fuso horário (ex: America/Sao_Paulo, Europe/London). Se não fornecido, o sistema tentará usar 'America/Sao_Paulo' ou um fuso apropriado se uma cidade for inferida da pergunta do usuário.",
                            }
                        }
                    }
                },
                {
                    name: "getCurrentWeather",
                    description: "Obtém o clima atual para uma localização. Tente com a cidade apenas (ex: 'Curitiba') se o código do país não for fornecido. Se houver erro de ambiguidade ou cidade não encontrada, a função informará para que você possa pedir o código do país ao usuário (ex: 'London, GB' ou 'Tokyo, JP').",
                    parameters: {
                        type: "object",
                        properties: {
                            location: {
                                type: "string",
                                description: "A localização para obter o clima (formato preferencial: cidade, código país. Ex: 'Paris, FR'. Mas tente apenas com 'cidade' se o código do país não for explicitamente fornecido pelo usuário).",
                            },
                        },
                        required: ["location"],
                    },
                },
                {
                    name: "getHistoricalFact",
                    description: "Obtém um fato histórico sobre uma data específica.",
                    parameters: {
                        type: "object",
                        properties: {
                            date: {
                                type: "string",
                                description: "Data no formato MM-DD (ex: 07-04 para 4 de julho)",
                            },
                        },
                    },
                },
                {
                    name: "getFunFact",
                    description: "Obtém uma curiosidade interessante sobre qualquer assunto.",
                    parameters: {
                        type: "object",
                        properties: {
                            topic: {
                                type: "string",
                                description: "Tópico sobre o qual deseja a curiosidade",
                            },
                        },
                    },
                }
            ]
        }
    ]
});

// Middlewares
app.use(express.json());
app.use(express.static(__dirname));

app.use(cors());

//app.use(cors('origin:*'));


// Funções auxiliares
async function getCurrentTime({ timezone = "America/Sao_Paulo" } = {}) {
    // Se nenhum timezone for passado explicitamente pelo Gemini, usa o default.
    // O Gemini será instruído a tentar inferir 'America/Sao_Paulo' para 'Curitiba'.
    const effectiveTimezone = timezone || "America/Sao_Paulo";

    try {
        const response = await axios.get(`https://worldtimeapi.org/api/timezone/${effectiveTimezone}`);
        const date = new Date(response.data.datetime);

        const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: effectiveTimezone };
        const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: effectiveTimezone, hour12: false };

        const formattedDate = date.toLocaleDateString('pt-BR', dateOptions);
        const formattedTime = date.toLocaleTimeString('pt-BR', timeOptions);

        return {
            datetime: response.data.datetime,
            timezone: effectiveTimezone,
            date: formattedDate,
            time: formattedTime,
            formatted: `Em ${effectiveTimezone}: Data: ${formattedDate}, Hora: ${formattedTime}.`
        };
    } catch (error) {
        console.error(`Erro ao obter a hora para ${effectiveTimezone}:`, error.message);
        let userFriendlyError = `Não foi possível obter a data/hora para ${effectiveTimezone}.`;
        if (error.response && error.response.data && error.response.data.error === "unknown location") {
            userFriendlyError = `Desculpe, o fuso horário "${effectiveTimezone}" não foi reconhecido. Por favor, tente um fuso horário válido (ex: America/Sao_Paulo) ou verifique se a cidade mencionada tem um fuso padrão conhecido.`;
        }
        return { error: userFriendlyError, formatted: userFriendlyError };
    }
}

async function getCurrentWeather({ location }) {
    if (!openWeatherMapApiKey || openWeatherMapApiKey === "SUA_CHAVE_DO_OPENWEATHERMAP") {
        const errorMessage = "Chave da API OpenWeatherMap não configurada ou inválida.";
        console.error(errorMessage);
        return { error: errorMessage, formatted: errorMessage };
    }
    try {
        const [city, countryCode] = location.split(',').map(item => item.trim());
        if (!city) {
            const errorMessage = "Nome da cidade não fornecido para a previsão do tempo.";
             console.error(errorMessage);
            return { error: errorMessage, formatted: errorMessage };
        }
        const query = countryCode ? `${city},${countryCode}` : city;
        const apiUrl = `https://api.openweathermap.org/data/2.5/weather?q=${query}&appid=${openWeatherMapApiKey}&units=metric&lang=pt_br`;
        const response = await axios.get(apiUrl);
        const weatherData = response.data;

        return {
            type: "weather",
            locationName: weatherData.name,
            country: weatherData.sys.country,
            description: weatherData.weather[0].description,
            temperature: weatherData.main.temp,
            humidity: weatherData.main.humidity,
            windSpeed: weatherData.wind.speed,
            icon: weatherData.weather[0].icon,
            formatted: `Clima em ${weatherData.name}, ${weatherData.sys.country}: ${weatherData.weather[0].description}. Temperatura: ${weatherData.main.temp}°C. Umidade: ${weatherData.main.humidity}%. Vento: ${weatherData.wind.speed} m/s.`
        };
    } catch (error) {
        console.error(`Erro ao obter o clima para ${location}:`, error.response?.data?.message || error.message);
        const friendlyMessage = `Não foi possível obter o clima para "${location}". Verifique se o nome da cidade está correto. Se o problema persistir, tente adicionar o código do país (ex: "Curitiba, BR").`;
        return { error: friendlyMessage, formatted: friendlyMessage };
    }
}

async function getHistoricalFact({ date }) {
    try {
        const today = new Date();
        const [month, day] = date ? date.split('-') : [today.getMonth() + 1, today.getDate()];
        const response = await axios.get(`http://history.muffinlabs.com/date/${month}/${day}`);
        const data = response.data;
        const events = data.data.Events;
        if (!events || events.length === 0) {
            return { error: "Nenhum evento histórico encontrado para esta data.", formatted: "Nenhum evento histórico encontrado para esta data." };
        }
        const randomEvent = events[Math.floor(Math.random() * events.length)];
        return {
            year: randomEvent.year,
            event: randomEvent.text,
            formatted: `Em ${randomEvent.year}, ${randomEvent.text}`
        };
    } catch (error) {
        console.error("Erro ao obter fato histórico:", error.message);
        return { error: "Não foi possível obter um fato histórico neste momento.", formatted: "Não foi possível obter um fato histórico neste momento." };
    }
}

async function getFunFact({ topic = "aleatório" }) {
    try {
        const prompt = `Me forneça uma curiosidade interessante e concisa sobre ${topic}.`;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        return {
            topic: topic,
            fact: text,
            formatted: text
        };
    } catch (error) {
        console.error("Erro ao obter curiosidade:", error.message);
        const fallbackFact = "O mel nunca estraga. Arqueólogos encontraram potes de mel em tumbas egípcias com mais de 3.000 anos que ainda estavam comestíveis!";
        return {
            topic: "fallback",
            fact: fallbackFact,
            formatted: `Aqui está uma curiosidade: ${fallbackFact}`
        };
    }
}

// Rotas
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/chat', async (req, res) => {
    let structuredFunctionResult = null;

    try {
        const userMessage = req.body.message;
        if (!userMessage) {
            return res.status(400).json({ error: 'Nenhuma mensagem recebida.' });
        }

        console.log("Recebido do usuário:", userMessage);


        const mydata= getCurrentTime();

        const chat = model.startChat({
            history: [
                {
                    role: "user",
                    parts: [{ text: "data e hora de agora:" + mydata
                        
                     }],
                },
                {   
                    role: "model",
                    parts: [{ text: "Olá! Sou o Jarvis, seu assistente pessoal. Estou pronto para conversar sobre o que você quiser. O que lhe interessa hoje?" }],
                },
            ],
        });

        const result = await chat.sendMessage(userMessage);
        const response = await result.response;

        if (response.promptFeedback?.blockReason) {
            console.error("Mensagem bloqueada pela API:", response.promptFeedback.blockReason);
            return res.status(400).json({ error: `Sua mensagem foi bloqueada: ${response.promptFeedback.blockReason}. Tente reformular.` });
        }

        let botResponseText;

        if (response.candidates?.[0]?.content?.parts?.[0]?.functionCall) {
            const functionCall = response.candidates[0].content.parts[0].functionCall;
            const functionName = functionCall.name;
            const functionArgs = functionCall.args || {}; // Garante que args seja um objeto

            console.log("Chamada de função detectada:", functionName, functionArgs);

            let functionResultPayload;
            switch (functionName) {
                case "getCurrentTime":
                    // Se Gemini não passar timezone, a função getCurrentTime usará o default.
                    // Para "que horas em Curitiba", esperamos que Gemini passe { timezone: "America/Sao_Paulo" }
                    // Para "que dia é hoje", esperamos que Gemini chame sem args ou com { timezone: "America/Sao_Paulo" }
                    functionResultPayload = await getCurrentTime(functionArgs);
                    break;
                case "getCurrentWeather":
                    functionResultPayload = await getCurrentWeather(functionArgs);
                    if (functionResultPayload && functionResultPayload.type === "weather" && !functionResultPayload.error) {
                        structuredFunctionResult = functionResultPayload;
                    }
                    break;
                case "getHistoricalFact":
                    functionResultPayload = await getHistoricalFact(functionArgs);
                    break;
                case "getFunFact":
                    functionResultPayload = await getFunFact(functionArgs);
                    break;
                default:
                    functionResultPayload = { error: "Função não implementada.", formatted: "Desculpe, essa função não está implementada." };
            }

            const resultWithFunctionResponse = await chat.sendMessage([
                {
                    functionResponse: {
                        name: functionName,
                        response: functionResultPayload
                    }
                },
            ]);
            const finalResponse = await resultWithFunctionResponse.response;
            botResponseText = finalResponse.text();

            // As instruções no prompt devem fazer o Gemini usar o erro da função.
            // Se functionResultPayload.error existir e o Gemini não o mencionou adequadamente,
            // a resposta do Gemini pode ser menos útil. O prompt foi reforçado para isso.
            if (functionResultPayload.error && botResponseText && !botResponseText.toLowerCase().includes(functionResultPayload.error.toLowerCase().slice(0, 30))) {
                console.warn("Gemini pode não ter usado completamente a mensagem de erro da função. Resposta do Gemini:", botResponseText, "Erro da função:", functionResultPayload.formatted);
                // Poderíamos forçar, mas idealmente o prompt resolve:
                // botResponseText = functionResultPayload.formatted; // Ou uma combinação
            }


        } else if (response.text) {
            botResponseText = response.text();
        } else {
            botResponseText = "Entendo. Para te ajudar melhor, poderia reformular sua pergunta ou me dar mais contexto sobre o que você gostaria de conversar?";
        }

        console.log("Enviando para o usuário:", botResponseText);
        res.json({ response: botResponseText, weatherData: structuredFunctionResult });

    } catch (error) {
        console.error("Erro detalhado no /chat:", error);
        let errorMessage = 'Erro interno ao processar a mensagem.';
        let statusCode = 500;

        if (error.message?.includes('API key not valid')) {
            errorMessage = 'Chave de API do Gemini inválida. Verifique sua configuração no arquivo .env';
            statusCode = 401;
        } else if (error.response && error.response.data && error.response.data.error) {
            errorMessage = `Erro da API Gemini: ${error.response.data.error.message || 'Erro desconhecido'}`;
            statusCode = error.response.status || 500;
        }
        res.status(statusCode).json({ error: errorMessage });
    }
});

app.listen(port, () => {
    console.log(`\n🤖 Servidor rodando em http://localhost:${port}`);
    console.log(`🔑 Gemini API Key: ${apiKey && apiKey !== "YOUR_API_KEY_HERE" && apiKey.length >= 30 ? 'Configurada' : 'NÃO CONFIGURADA OU INVÁLIDA'}`);
    console.log(`🌦️ Weather API Key: ${openWeatherMapApiKey && openWeatherMapApiKey !== "SUA_CHAVE_DO_OPENWEATHERMAP" && openWeatherMapApiKey.length >= 20 ? 'Configurada' : 'NÃO CONFIGURADA OU INVÁLIDA'}`);
    if (!apiKey || apiKey === "YOUR_API_KEY_HERE" || apiKey.length < 30) {
        console.error("!!! ERRO CRÍTICO: A chave da API do Gemini não está configurada corretamente no arquivo .env !!!");
    }
    if (!openWeatherMapApiKey || openWeatherMapApiKey === "SUA_CHAVE_DO_OPENWEATHERMAP" || openWeatherMapApiKey.length < 20) {
        console.error("!!! AVISO: A chave da API do OpenWeatherMap não está configurada corretamente no arquivo .env. A funcionalidade de clima não funcionará. !!!");
    }
});