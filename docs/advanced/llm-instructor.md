# CSMA Instructor - Usage Examples

## Basic Extraction

```javascript
import { createInstructor } from './services/llm/Instructor.js';
import { object, string, number } from './runtime/validation/index.js';
import { email } from './runtime/validation/validators/semantic.js';

// 1. Create instructor instance
const instructor = createInstructor(eventBus, {
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4',
    debug: true
});

// 2. Define schema using CSMA validation
const UserSchema = object({
    name: string(),
    age: number(),
    email: email()
});

// 3. Extract structured data
const user = await instructor.extract({
    schema: UserSchema,
    prompt: 'Extract user info: John Doe, 30 years old, john@example.com'
});

console.log(user);
// { name: "John Doe", age: 30, email: "john@example.com" }
```

---

## With Retry Logic

```javascript
import { object, string, array } from './runtime/validation/index.js';
import { llmInput } from './runtime/validation/validators/security.js';

// Schema with security validation
const TaskSchema = object({
    title: llmInput(200),  // Max 200 chars, checks for prompt injection
    description: string(),
    tags: array(string())
});

try {
    const task = await instructor.extract({
        schema: TaskSchema,
        prompt: 'Create a task: Buy groceries for the week, include milk and bread',
        name: 'extract_task',
        maxRetries: 3  // Will retry up to 3 times on validation errors
    });
    
    // Publish to EventBus
    eventBus.publish('TASK_CREATED', task);
} catch (error) {
    console.error('Extraction failed:', error);
}
```

---

## Streaming Extraction

```javascript
import { object, string, array } from './runtime/validation/index.js';

const MeetingNotesSchema = object({
    attendees: array(string()),
    keyPoints: array(string()),
    actionItems: array(string())
});

// Stream partial results as they come in
for await (const partial of instructor.extractStream({
    schema: MeetingNotesSchema,
    prompt: `
        Extract meeting notes from this transcript:
        John and Sarah discussed Q4 budget. 
        Action items: Follow up with finance team, 
        prepare presentation for board meeting.
    `
})) {
    console.log('Partial extraction:', partial);
    // Update UI in real-time
    updateUI(partial);
}
```

---

## With ECCA Metadata

```javascript
import { eventContract } from './runtime/validation/contract.js';
import { object, string, enums } from './runtime/validation/index.js';

// Define contract with ECCA metadata
const EmailExtractContract = eventContract({
    version: '1.0',
    name: 'EMAIL_EXTRACTED',
    owner: 'ai-service',
    lifecycle: 'stable',
    description: 'Extract email address from text',
    schema: object({
        email: email(),
        name: string(),
        type: enums(['work', 'personal'])
    })
});

// Extract and validate
const extracted = await instructor.extract({
    schema: EmailExtractContract.schema,
    prompt: 'Contact: jane.smith@company.com (work email)'
});

// Validate with contract
const [error, validated] = EmailExtractContract.validate(extracted);

if (!error) {
    eventBus.publish('EMAIL_EXTRACTED', validated);
}
```

---

## Complex Nested Structures

```javascript
import { object, string, array, number, optional } from './runtime/validation/index.js';

const ResumeSchema = object({
    name: string(),
    email: email(),
    phone: optional(string()),
    experience: array(object({
        company: string(),
        role: string(),
        years: number(),
        responsibilities: array(string())
    })),
    skills: array(string())
});

const resume = await instructor.extract({
    schema: ResumeSchema,
    prompt: `
        Extract resume data:
        John Doe
        john@email.com
        
        Work Experience:
        - Google, Software Engineer, 5 years
          Responsibilities: Built scalable systems, led team of 3
        - Microsoft, Developer, 3 years
          Responsibilities: Developed APIs, wrote documentation
        
        Skills: JavaScript, Python, AWS, Docker
    `,
    systemPrompt: 'You are a precise resume parser. Extract all information accurately.'
});

console.log(resume);
```

---

## EventBus Integration

```javascript
// Subscribe to extraction events
eventBus.subscribe('LLM_EXTRACTION_COMPLETED', ({ name, data, attempts }) => {
    console.log(`✅ Extracted ${name} in ${attempts} attempts`);
    console.log('Data:', data);
});

eventBus.subscribe('LLM_EXTRACTION_FAILED', ({ name, error, attempts }) => {
    console.error(`❌ Failed to extract ${name} after ${attempts} attempts`);
    console.error('Error:', error);
    
    // Log to analytics
    logAccumulator.log('llm-extraction-failed', { name, error });
});
```

---

## Different Providers

```javascript
// OpenAI (default)
const openaiInstructor = createInstructor(eventBus, {
    apiKey: process.env.OPENAI_API_KEY
});

// Groq (fast, cheap)
const groqInstructor = createInstructor(eventBus, {
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://api.groq.com/openai/v1',
    model: 'mixtral-8x7b-32768'
});

// Together AI
const togetherInstructor = createInstructor(eventBus, {
    apiKey: process.env.TOGETHER_API_KEY,
    baseURL: 'https://api.together.xyz/v1',
    model: 'mistralai/Mixtral-8x7B-Instruct-v0.1'
});
```

---

## Error Handling

```javascript
try {
    const data = await instructor.extract({
        schema: MySchema,
        prompt: 'Extract this...'
    });
} catch (error) {
    if (error.message.includes('API error')) {
        // Handle API errors (rate limits, auth, etc.)
        console.error('OpenAI API error:', error);
    } else if (error.message.includes('Max retries')) {
        // Handle validation failures after retries
        console.error('Validation failed after retries:', error);
    } else {
        // Other errors
        console.error('Unexpected error:', error);
    }
}
```

---

## Production Configuration

```javascript
// config.js
export const LLM_CONFIG = {
    apiKey: process.env.OPENAI_API_KEY,
    model: import.meta.env.PROD ? 'gpt-3.5-turbo' : 'gpt-4',  // Cheaper in prod
    maxRetries: 2,  // Fewer retries in prod
    debug: import.meta.env.DEV  // Only debug in development
};

// main.js
if (FEATURES.LLM_INSTRUCTOR) {
    const instructor = createInstructor(eventBus, LLM_CONFIG);
    serviceManager.register('instructor', instructor);
}
```
