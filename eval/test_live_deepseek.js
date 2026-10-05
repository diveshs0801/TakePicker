// Test script for live DeepSeek API connection
const apiKey = process.env.DEEPSEEK_API_KEY || "sk-1b5878c4e3344f828f356ffb3f1b0bd1";
const baseUrl = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";

console.log(`Connecting to DeepSeek endpoint: ${baseUrl} with model: ${model}...`);

async function testDeepSeek() {
  const endpoint = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

  const payload = {
    model,
    messages: [
      {
        role: "system",
        content: "You are TakePicker's AI video editor agent. You edit videos by calling validated tools that modify a timeline description. Current timeline has 3 clips: clip_1 (0s-5s), clip_2 (5s-12s), clip_3 (12s-20s)."
      },
      {
        role: "user",
        content: "Please delete clip 2 from the timeline."
      }
    ],
    tools: [
      {
        type: "function",
        function: {
          name: "remove_clip",
          description: "Deletes a clip from the timeline by clipId.",
          parameters: {
            type: "object",
            properties: {
              clipId: {
                type: "string",
                description: "The ID of the clip to remove, e.g. clip_2"
              }
            },
            required: ["clipId"]
          }
        }
      }
    ],
    tool_choice: "auto",
    temperature: 0
  };

  const startTime = Date.now();
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    const elapsed = Date.now() - startTime;
    console.log(`HTTP Status: ${res.status} ${res.statusText} (${elapsed}ms)`);

    const json = await res.json();
    if (!res.ok) {
      console.error("API returned error:", json);
      return;
    }

    const choice = json.choices?.[0];
    const message = choice?.message;
    console.log("\n--- DeepSeek Response ---");
    console.log("Role:", message?.role);
    console.log("Content:", message?.content);
    console.log("Tool Calls:", JSON.stringify(message?.tool_calls, null, 2));
    console.log("Usage:", json.usage);

    if (message?.tool_calls?.length > 0) {
      const tc = message.tool_calls[0];
      console.log(`\n✅ SUCCESS: DeepSeek accurately invoked tool "${tc.function.name}" with arguments: ${tc.function.arguments}`);
    } else {
      console.log("\n⚠️ Note: No tool call returned. Message was:", message?.content);
    }
  } catch (err) {
    console.error("Failed to connect to DeepSeek API:", err.message);
  }
}

testDeepSeek();
