import OpenAI from "openai";

let openaiInstance: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  if (!openaiInstance) {
    openaiInstance = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiInstance;
}

export async function generatePRDescription(diff: string): Promise<string> {
  const prompt = `
    Analyze the following PR diff and generate a concise, professional description.
    The description should include a summary of the changes, the key modifications,
    and the potential impact.

    Diff:
    ${diff}
  `;

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 256,
      temperature: 0.7,
    });
    
    const description = response.choices[0].message?.content?.trim();
    return description || "Could not generate a description.";
    
  } catch (error) {
    console.error("Error generating PR description from OpenAI:", error);
    return "Error generating description.";
  }
}

