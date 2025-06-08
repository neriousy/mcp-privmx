import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { NextRequest, NextResponse } from 'next/server';

interface MessageInput {
  role: string;
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();

    if (!messages || messages.length === 0) {
      return NextResponse.json({ title: 'New Chat' });
    }

    // Get the first few messages to understand the conversation context
    const contextMessages = (messages as MessageInput[])
      .slice(0, 3)
      .map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

    const prompt = `Based on this conversation, generate a concise, descriptive title (max 4-6 words) that captures the main topic or task being discussed. Focus on the technical subject matter.

Conversation:
${contextMessages.map((msg) => `${msg.role}: ${msg.content}`).join('\n\n')}

Generate only the title, nothing else:`;

    const result = await generateText({
      model: openai('gpt-4o-mini'),
      prompt,
      maxTokens: 20,
      temperature: 0.3,
    });

    const title = result.text.trim().replace(/^["']|["']$/g, ''); // Remove quotes if present

    return NextResponse.json({
      title: title || 'New Chat',
    });
  } catch (error) {
    console.error('Error generating title:', error);
    return NextResponse.json({ title: 'New Chat' });
  }
}
