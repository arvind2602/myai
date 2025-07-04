import logging
from openai import AsyncOpenAI

# Configure logging for this module
logger = logging.getLogger(__name__)

class AIInteractionService:
    """
    Manages interactions with the OpenAI chat model, including conversation history.
    """
    def __init__(self, openai_client: AsyncOpenAI, system_message: str, max_history: int = 5):
        """
        Initializes the AIInteractionService.

        Args:
            openai_client: An instance of AsyncOpenAI for chat completions.
            system_message: The initial system message to set the AI's persona.
            max_history: The maximum number of messages to keep in the conversation history.
        """
        self.openai_client = openai_client
        self.system_message = system_message
        self.max_history = max_history
        # Initialize history with system message
        self.history = [{"role": "system", "content": system_message}]

    async def get_ai_response(self, user_text: str, initial_message: str = None) -> str:
        """
        Sends user input to the AI model and retrieves a response.

        Manages conversation history to keep it within `max_history` limits.
        Optionally includes an initial message for user context.

        Args:
            user_text: The user's input text.
            initial_message: Optional initial user state or context to include in history.

        Returns:
            The AI's generated response.

        Raises:
            Exception: If an error occurs during the OpenAI chat completion API call.
        """
        # Create a new history for this request to handle initial_message
        current_history = self.history.copy()

        # Add initial_message to history if provided (only once per request)
        if initial_message and not any(msg["content"] == initial_message for msg in current_history):
            current_history.append({"role": "user", "content": initial_message})

        # Add the current user input
        current_history.append({"role": "user", "content": user_text})

        # Prune history to maintain a manageable conversation length
        if len(current_history) > self.max_history:
            # Keep the system message and the most recent messages
            current_history = [current_history[0]] + current_history[-(self.max_history - 1):]

        try:
            response = await self.openai_client.chat.completions.create(
                model="gpt-4o-mini",  # Using a cost-effective and fast model
                messages=current_history,
                temperature=0.5  # Moderate creativity
            )
            message = response.choices[0].message.content
            # Update the persistent history with user input and AI response
            self.history = current_history
            self.history.append({"role": "system", "content": message})
            # Prune persistent history if needed
            if len(self.history) > self.max_history:
                self.history = [self.history[0]] + self.history[-(self.max_history - 1):]
            logger.info(f"AI response generated: '{message}'")
            return message
        except Exception as e:
            logger.error(f"OpenAI chat completion error: {str(e)}")
            raise Exception(f"Failed to get AI response: {str(e)}")

    def reset_history(self):
        """
        Resets the conversation history, keeping only the initial system message.
        """
        self.history = [{"role": "system", "content": self.system_message}]
        logger.info("Conversation history reset.")