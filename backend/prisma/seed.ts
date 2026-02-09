import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Survey type definitions
const surveyTypes = [
  {
    slug: "marijuana",
    name: "Marijuana Awareness",
    description: "Survey focused on marijuana use and driving impairment awareness",
  },
  {
    slug: "alcohol",
    name: "Alcohol Awareness",
    description: "Survey focused on alcohol use and driving impairment awareness",
  },
  {
    slug: "distracted",
    name: "Distracted Driving",
    description: "Survey focused on distracted driving awareness (texting, phone use, etc.)",
  },
  {
    slug: "impaired",
    name: "Impaired Driving",
    description: "General impaired driving survey covering multiple substances",
  },
  {
    slug: "combo",
    name: "Combination Survey",
    description: "Comprehensive survey covering multiple risk factors",
  },
];

// Placeholder questions for each survey type (11 questions each)
const createQuestionsForSurveyType = (surveyTypeSlug: string) => {
  const baseQuestions = [
    {
      orderIndex: 1,
      questionText: "Have you ever driven after using any substances?",
      options: JSON.stringify(["Yes", "No", "Prefer not to say"]),
    },
    {
      orderIndex: 2,
      questionText: "Do you know someone who has driven while impaired?",
      options: JSON.stringify(["Yes", "No", "Not sure"]),
    },
    {
      orderIndex: 3,
      questionText: "How often do you see impaired driving awareness messages?",
      options: JSON.stringify(["Daily", "Weekly", "Monthly", "Rarely", "Never"]),
    },
    {
      orderIndex: 4,
      questionText: "Do you think impaired driving is a serious problem in your community?",
      options: JSON.stringify(["Strongly agree", "Agree", "Neutral", "Disagree", "Strongly disagree"]),
    },
    {
      orderIndex: 5,
      questionText: "Have you ever been a passenger with an impaired driver?",
      options: JSON.stringify(["Yes", "No", "Not sure"]),
    },
    {
      orderIndex: 6,
      questionText: "Would you intervene if a friend was about to drive impaired?",
      options: JSON.stringify(["Definitely yes", "Probably yes", "Not sure", "Probably no", "Definitely no"]),
    },
    {
      orderIndex: 7,
      questionText: "Do you know the legal consequences of impaired driving in your state?",
      options: JSON.stringify(["Yes, very well", "Somewhat", "Not really", "Not at all"]),
    },
    {
      orderIndex: 8,
      questionText: "Have you discussed impaired driving with friends or family?",
      options: JSON.stringify(["Yes, frequently", "Yes, occasionally", "Rarely", "Never"]),
    },
    {
      orderIndex: 9,
      questionText: "Do you have a designated driver plan when going out?",
      options: JSON.stringify(["Always", "Usually", "Sometimes", "Rarely", "Never"]),
    },
    {
      orderIndex: 10,
      questionText: "How effective do you think awareness programs are?",
      options: JSON.stringify(["Very effective", "Somewhat effective", "Neutral", "Not very effective", "Not effective at all"]),
    },
    {
      orderIndex: 11,
      questionText: "Will you pledge to never drive impaired?",
      options: JSON.stringify(["Yes, I pledge", "I already have this commitment", "I need to think about it"]),
    },
  ];

  // Customize first question based on survey type
  const typeSpecificQuestions: Record<string, Partial<typeof baseQuestions[0]>> = {
    marijuana: {
      questionText: "Have you ever driven after using marijuana?",
    },
    alcohol: {
      questionText: "Have you ever driven after drinking alcohol?",
    },
    distracted: {
      questionText: "Have you ever used your phone while driving?",
      options: JSON.stringify(["Yes, frequently", "Yes, occasionally", "Rarely", "Never"]),
    },
    impaired: {
      questionText: "Have you ever driven while feeling impaired by any substance?",
    },
    combo: {
      questionText: "Have you engaged in any risky driving behaviors?",
      options: JSON.stringify(["Substance use while driving", "Phone use while driving", "Both", "Neither"]),
    },
  };

  return baseQuestions.map((q, index) => {
    if (index === 0 && typeSpecificQuestions[surveyTypeSlug]) {
      return { ...q, ...typeSpecificQuestions[surveyTypeSlug] };
    }
    return q;
  });
};

async function main() {
  console.log("Starting seed...");

  // Clear existing data (in reverse order of dependencies)
  console.log("Clearing existing data...");
  await prisma.emailQueue.deleteMany();
  await prisma.syncLog.deleteMany();
  await prisma.pledge.deleteMany();
  await prisma.photo.deleteMany();
  await prisma.surveyResponse.deleteMany();
  await prisma.surveyQuestion.deleteMany();
  await prisma.surveyType.deleteMany();
  await prisma.event.deleteMany();
  await prisma.device.deleteMany();
  await prisma.team.deleteMany();

  // Create survey types with questions
  console.log("Creating survey types and questions...");
  for (const surveyType of surveyTypes) {
    const createdType = await prisma.surveyType.create({
      data: {
        slug: surveyType.slug,
        name: surveyType.name,
        description: surveyType.description,
        isActive: true,
      },
    });

    const questions = createQuestionsForSurveyType(surveyType.slug);
    for (const question of questions) {
      await prisma.surveyQuestion.create({
        data: {
          surveyTypeId: createdType.id,
          orderIndex: question.orderIndex,
          questionText: question.questionText,
          answerType: "single_choice",
          options: question.options,
          isRequired: true,
        },
      });
    }

    console.log(`  Created survey type: ${surveyType.name} with ${questions.length} questions`);
  }

  // Create sample team for testing
  console.log("Creating sample team...");
  const sampleTeam = await prisma.team.create({
    data: {
      name: "Demo Tour Team",
      code: "DEMO2024",
    },
  });
  console.log(`  Created team: ${sampleTeam.name} (code: ${sampleTeam.code})`);

  // Create sample devices for the team
  console.log("Creating sample devices...");
  const tablet = await prisma.device.create({
    data: {
      teamId: sampleTeam.id,
      deviceType: "tablet",
      deviceName: "Kiosk Tablet 1",
      isActive: true,
    },
  });

  const phone = await prisma.device.create({
    data: {
      teamId: sampleTeam.id,
      deviceType: "phone",
      deviceName: "Photo Hub Phone 1",
      isActive: true,
    },
  });
  console.log(`  Created devices: ${tablet.deviceName}, ${phone.deviceName}`);

  // Create a sample event
  console.log("Creating sample event...");
  const sampleEvent = await prisma.event.create({
    data: {
      teamId: sampleTeam.id,
      venueName: "Demo High School",
      venueCity: "Springfield",
      venueState: "IL",
      eventDate: new Date(),
      surveyTypes: JSON.stringify(["marijuana", "alcohol", "distracted"]),
      overlayType: "arrive_alive_standard",
      status: "active",
    },
  });
  console.log(`  Created event: ${sampleEvent.venueName} (${sampleEvent.venueCity}, ${sampleEvent.venueState})`);

  console.log("\nSeed completed successfully!");
  console.log("\nSummary:");
  console.log(`  - ${surveyTypes.length} survey types with 11 questions each`);
  console.log(`  - 1 sample team (code: ${sampleTeam.code})`);
  console.log(`  - 2 sample devices (1 tablet, 1 phone)`);
  console.log(`  - 1 sample event`);
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
