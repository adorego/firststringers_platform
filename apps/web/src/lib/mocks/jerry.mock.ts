import type { ChatMessage } from "@/types";

export const mockConversation: ChatMessage[] = [
  {
    id: "msg-01",
    sender: "jerry",
    content:
      "Hey! I'm Jerry, your recruiting AI agent. I'm here to help organize your athletic career, track opportunities, and connect you with the right programs. Let's get started — tell me about yourself!",
    timestamp: "2026-03-15T09:00:00Z",
    isAiGenerated: true,
  },
  {
    id: "msg-02",
    sender: "athlete",
    content:
      "Hey Jerry! I'm a point guard from Austin, Texas. Just finished my junior year averaging 18 points and 7 assists.",
    timestamp: "2026-03-15T09:05:00Z",
  },
  {
    id: "msg-03",
    sender: "jerry",
    content:
      "That's awesome! Those are solid numbers. I'm updating your profile with that info. Have you started thinking about what kind of program you're looking for? Division I, II, III? Any specific region or style of play you prefer?",
    timestamp: "2026-03-15T09:06:00Z",
    isAiGenerated: true,
  },
  {
    id: "msg-04",
    sender: "athlete",
    content:
      "Definitely D1. I want a program that runs an up-tempo offense. Preferably Southwest or Southeast — I want to stay somewhat close to home.",
    timestamp: "2026-03-15T09:08:00Z",
  },
  {
    id: "msg-05",
    sender: "jerry",
    content:
      "Got it — D1, up-tempo, Southwest or Southeast. That narrows it down nicely. What about academics? What's your current GPA and do you have a major in mind?",
    timestamp: "2026-03-15T09:08:30Z",
    isAiGenerated: true,
  },
  {
    id: "msg-06",
    sender: "athlete",
    content:
      "3.8 GPA. I'm thinking Computer Science, but I'm open to Engineering too.",
    timestamp: "2026-03-15T09:10:00Z",
  },
  {
    id: "msg-07",
    sender: "jerry",
    content:
      "3.8 with CS interest — that's a strong academic profile that a lot of programs will value. I've updated your dossier. Your completeness is now at 55%. A few more sections and you'll be visible to recruiters.",
    timestamp: "2026-03-15T09:10:30Z",
    isAiGenerated: true,
  },
  {
    id: "msg-08",
    sender: "athlete",
    content: "What else do I need to fill out?",
    timestamp: "2026-03-15T09:12:00Z",
  },
  {
    id: "msg-09",
    sender: "jerry",
    content:
      "You're missing physical measurements (height, weight), SAT/ACT scores, and a highlight video. The highlight reel is the biggest one — coaches watch film before anything else. Do you have any game footage we can link?",
    timestamp: "2026-03-15T09:12:20Z",
    isAiGenerated: true,
  },
  {
    id: "msg-10",
    sender: "athlete",
    content:
      "I'm 6'1\", 175 lbs. I have a highlight reel my coach put together on Hudl, let me grab the link.",
    timestamp: "2026-03-15T09:14:00Z",
  },
];
