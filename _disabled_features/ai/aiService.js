const axios = require('axios');

// Configuration for local DeepSeek model
// Supports both Ollama API and custom Python server
const DEEPSEEK_URL = process.env.DEEPSEEK_URL || 'http://localhost:11434/api/generate';
const MODEL_NAME = process.env.DEEPSEEK_MODEL || 'deepseek-finetuned';
const REQUEST_TIMEOUT = parseInt(process.env.AI_TIMEOUT) || 60000; // 60 second timeout for larger models

class AIService {
  /**
   * Generate AI content using local DeepSeek model
   * @param {string} task - The task type (itinerary, summary, description)
   * @param {object} input - Input data for the task
   * @returns {Promise<string>} Generated text
   */
  static async generate(task, input) {
    try {
      let prompt = '';

      switch (task) {
        case 'itinerary':
          prompt = this.buildItineraryPrompt(input);
          break;
        case 'trip_summary':
          prompt = this.buildTripSummaryPrompt(input);
          break;
        case 'event_description':
          prompt = this.buildEventDescriptionPrompt(input);
          break;
        default:
          throw new Error(`Unknown task type: ${task}`);
      }

      // Call local DeepSeek model (Ollama-like API or custom Python server)
      const response = await axios.post(
        DEEPSEEK_URL,
        {
          model: MODEL_NAME,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.95,
            max_tokens: 512,
          }
        },
        {
          timeout: REQUEST_TIMEOUT
        }
      );

      // Extract generated text
      if (response.data && response.data.response) {
        return response.data.response.trim();
      }

      throw new Error('Invalid response from AI model');
    } catch (error) {
      console.error('AI Generation Error:', error.message);

      // Fallback to template-based generation if AI service is unavailable
      console.log('Falling back to template-based generation');
      return this.fallbackGenerate(task, input);
    }
  }

  // Build prompts for different tasks
  static buildItineraryPrompt(input) {
    const { destination, startDate, endDate, interests, participants } = input;

    return `Generate a detailed travel itinerary for a trip to ${destination} from ${startDate} to ${endDate}.
${interests ? `Interests: ${interests.join(', ')}` : ''}
${participants ? `Number of travelers: ${participants}` : ''}

Please provide a day-by-day itinerary with activities, meals, and accommodation suggestions. Keep it concise but informative.`;
  }

  static buildTripSummaryPrompt(input) {
    const { title, destination, activities, highlights } = input;

    return `Write a brief and engaging summary for a trip titled "${title}" to ${destination}.
${activities ? `Activities included: ${activities.join(', ')}` : ''}
${highlights ? `Key highlights: ${highlights.join(', ')}` : ''}

Keep the summary to 2-3 sentences, making it exciting and informative.`;
  }

  static buildEventDescriptionPrompt(input) {
    const { title, location, eventDate, type } = input;

    return `Write an engaging description for a ${type} event titled "${title}" at ${location} on ${eventDate}.
Make it inviting and informative, about 2-3 sentences long.`;
  }

  // Fallback templates when AI is unavailable
  static fallbackGenerate(task, input) {
    switch (task) {
      case 'itinerary':
        return this.generateItineraryTemplate(input);
      case 'trip_summary':
        return this.generateTripSummaryTemplate(input);
      case 'event_description':
        return this.generateEventDescriptionTemplate(input);
      default:
        return 'Generated content will appear here.';
    }
  }

  static generateItineraryTemplate(input) {
    const { destination, startDate, endDate } = input;

    return `Day 1: Arrival in ${destination}
- Check into accommodation
- Explore local area and nearby attractions
- Welcome dinner at a local restaurant

Day 2: Main Activities
- Morning: Popular tourist attractions
- Afternoon: Cultural experiences
- Evening: Local entertainment

Day 3: Adventure Day
- Full-day adventure activities
- Lunch at scenic location
- Evening: Relaxation and dinner

Day 4: Departure
- Morning: Last-minute shopping or sightseeing
- Check out and travel home

Note: This is a template itinerary. Customize based on your preferences and interests.`;
  }

  static generateTripSummaryTemplate(input) {
    const { title, destination } = input;

    return `Join us for an unforgettable adventure to ${destination}! This ${title} promises exciting experiences, beautiful scenery, and lasting memories with great company.`;
  }

  static generateEventDescriptionTemplate(input) {
    const { title, location, type } = input;

    return `${title} is an exciting ${type} event taking place at ${location}. Join us for a memorable experience filled with fun, friendship, and adventure!`;
  }

  /**
   * Chat with AI for trip planning assistance
   * @param {string} message - User's message
   * @param {object} context - Optional context (trip details, etc.)
   * @returns {Promise<string>} AI response
   */
  static async chat(message, context = {}) {
    try {
      const systemPrompt = this.buildChatSystemPrompt(context);
      const fullPrompt = `${systemPrompt}\n\nUser: ${message}\n\nAssistant:`;

      const response = await axios.post(
        DEEPSEEK_URL,
        {
          model: MODEL_NAME,
          prompt: fullPrompt,
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.95,
            max_tokens: 1024,
          }
        },
        {
          timeout: REQUEST_TIMEOUT
        }
      );

      if (response.data && response.data.response) {
        return response.data.response.trim();
      }

      throw new Error('Invalid response from AI model');
    } catch (error) {
      console.error('AI Chat Error:', error.message);
      return this.fallbackChat(message, context);
    }
  }

  static buildChatSystemPrompt(context) {
    let systemPrompt = `You are Nostia AI, a friendly and helpful travel planning assistant. You help users plan trips, suggest destinations, create itineraries, recommend activities, and answer travel-related questions.

Be concise but informative. Use a warm, enthusiastic tone. When suggesting activities or places, be specific and practical.`;

    if (context.tripTitle) {
      systemPrompt += `\n\nThe user is currently planning a trip called "${context.tripTitle}"`;
      if (context.destination) systemPrompt += ` to ${context.destination}`;
      if (context.startDate && context.endDate) {
        systemPrompt += ` from ${context.startDate} to ${context.endDate}`;
      }
      if (context.participants) {
        systemPrompt += ` with ${context.participants} travelers`;
      }
      systemPrompt += '.';
    }

    return systemPrompt;
  }

  static fallbackChat(message, context) {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('itinerary') || lowerMessage.includes('plan')) {
      if (context.destination) {
        return `I'd love to help you plan your trip to ${context.destination}! Here are some suggestions:\n\n1. Research the best time to visit and local weather\n2. Look into popular attractions and hidden gems\n3. Plan your accommodation in a central location\n4. Consider local transportation options\n5. Make a list of must-try local foods\n\nWould you like me to generate a detailed day-by-day itinerary?`;
      }
      return `I'd be happy to help you plan your trip! To create the best itinerary, could you tell me:\n\n1. Where would you like to go?\n2. How many days will you be traveling?\n3. What are your interests (adventure, culture, food, relaxation)?\n4. How many people are traveling?`;
    }

    if (lowerMessage.includes('recommend') || lowerMessage.includes('suggest')) {
      return `Here are some popular travel recommendations:\n\n🏖️ **Beach Getaways:** Bali, Maldives, Thailand\n🏔️ **Adventure:** New Zealand, Costa Rica, Switzerland\n🏛️ **Culture & History:** Italy, Japan, Greece\n🌆 **City Exploration:** Tokyo, Paris, New York\n\nWhat type of experience are you looking for?`;
    }

    if (lowerMessage.includes('budget') || lowerMessage.includes('cost') || lowerMessage.includes('expensive')) {
      return `Great question about budgeting! Here are some tips:\n\n💰 **Save Money:**\n- Book flights 6-8 weeks in advance\n- Travel during shoulder season\n- Use local transportation\n- Stay in apartments instead of hotels\n- Eat where locals eat\n\nWould you like specific budget recommendations for a destination?`;
    }

    if (lowerMessage.includes('pack') || lowerMessage.includes('bring')) {
      return `Here's a general packing checklist:\n\n✅ **Essentials:**\n- Passport & travel documents\n- Phone & charger\n- Medications\n- Weather-appropriate clothing\n- Comfortable walking shoes\n- Toiletries\n\n✅ **Nice to have:**\n- Portable battery\n- Travel adapter\n- Reusable water bottle\n- Light jacket/layers\n\nNeed a destination-specific packing list?`;
    }

    return `I'm here to help with your travel planning! I can assist with:\n\n🗺️ Creating detailed itineraries\n✈️ Destination recommendations\n💰 Budget planning tips\n🎒 Packing suggestions\n🍽️ Food and activity recommendations\n\nWhat would you like help with?`;
  }
}

module.exports = AIService;
