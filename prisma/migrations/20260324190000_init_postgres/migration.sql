-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceFile" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "chapters" TEXT NOT NULL,
    "totalQuestions" INTEGER NOT NULL DEFAULT 0,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnkiCard" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "chapter" TEXT NOT NULL,
    "chapterId" INTEGER NOT NULL DEFAULT 0,
    "sourceQNumber" INTEGER NOT NULL,
    "difficulty" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "ankiType" TEXT NOT NULL,
    "clozeText" TEXT,
    "front" TEXT,
    "back" TEXT,
    "explanation" TEXT,
    "mnemonic" TEXT,
    "clinicalPearl" TEXT,
    "references" TEXT,
    "pitfalls" TEXT,
    "imageDependent" BOOLEAN NOT NULL DEFAULT false,
    "seeAlso" TEXT,
    "rawJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnkiCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationProgress" (
    "id" TEXT NOT NULL,
    "currentChapterId" INTEGER NOT NULL DEFAULT 1,
    "currentQuestionNumber" INTEGER NOT NULL DEFAULT 0,
    "totalCardsGenerated" INTEGER NOT NULL DEFAULT 0,
    "totalQuestionsTarget" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "batchSize" INTEGER NOT NULL DEFAULT 5,
    "cardType" TEXT NOT NULL DEFAULT 'cloze',
    "extras" TEXT NOT NULL DEFAULT '[]',
    "lastError" TEXT,
    "sourceFileId" TEXT,
    "startedAt" TIMESTAMP(3),
    "lastRunAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GenerationProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationJob" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "chapters" TEXT NOT NULL,
    "cardType" TEXT NOT NULL,
    "extras" TEXT NOT NULL,
    "batchSize" INTEGER NOT NULL DEFAULT 25,
    "cardsGenerated" INTEGER NOT NULL DEFAULT 0,
    "cardsTarget" INTEGER NOT NULL DEFAULT 0,
    "currentBatch" INTEGER NOT NULL DEFAULT 0,
    "totalBatches" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "GenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AnkiCard_cardId_key" ON "AnkiCard"("cardId");

-- CreateIndex
CREATE INDEX "AnkiCard_chapter_idx" ON "AnkiCard"("chapter");

-- CreateIndex
CREATE INDEX "AnkiCard_chapterId_idx" ON "AnkiCard"("chapterId");

-- CreateIndex
CREATE INDEX "AnkiCard_difficulty_idx" ON "AnkiCard"("difficulty");

-- CreateIndex
CREATE INDEX "AnkiCard_ankiType_idx" ON "AnkiCard"("ankiType");
