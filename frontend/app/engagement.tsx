import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import {
  getUserStats,
  getDailyQuizzes,
  submitQuizAnswer,
  UserStatsResponse,
  QuizQuestion,
  QuizSubmitResponse,
} from "../lib/api";

export default function EngagementScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<UserStatsResponse | null>(null);
  const [quizzes, setQuizzes] = useState<QuizQuestion[]>([]);
  const [activeQuizIndex, setActiveQuizIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [quizResult, setQuizResult] = useState<QuizSubmitResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [statsData, quizzesData] = await Promise.all([
        getUserStats("default_user"),
        getDailyQuizzes(),
      ]);
      setStats(statsData);
      setQuizzes(quizzesData);
    } catch (e) {
      console.error("Error loading engagement data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuizSubmit = async (answer: string) => {
    if (!quizzes[activeQuizIndex] || isSubmitting) return;
    setSelectedOption(answer);
    setIsSubmitting(true);
    try {
      const quiz = quizzes[activeQuizIndex];
      const res = await submitQuizAnswer(quiz.id, answer, "default_user");
      setQuizResult(res);
      // Refresh user stats
      const updatedStats = await getUserStats("default_user");
      setStats(updatedStats);
    } catch (e) {
      console.error("Error submitting quiz:", e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNextQuiz = () => {
    setSelectedOption(null);
    setQuizResult(null);
    setActiveQuizIndex((prev) => (prev + 1) % (quizzes.length || 1));
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-white justify-center items-center">
        <ActivityIndicator size="large" color="#2E7D32" />
        <Text className="text-gray-600 mt-4">Loading your journey & quizzes...</Text>
      </View>
    );
  }

  const currentQuiz = quizzes[activeQuizIndex];

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="p-6">
        {/* Header */}
        <View className="mb-6 flex-row justify-between items-center">
          <View>
            <Text className="text-3xl font-bold text-gray-900">Your Journey</Text>
            <Text className="text-gray-500 text-sm">Level {stats?.level || 1} Nutrition Explorer</Text>
          </View>
          <View className="bg-brand-green/10 border border-brand-green px-4 py-2 rounded-full">
            <Text className="text-brand-green font-bold text-sm">⭐ {stats?.xp || 0} XP</Text>
          </View>
        </View>

        {/* Streak & Stats Card */}
        <View className="bg-brand-green rounded-3xl p-6 mb-6 shadow-lg">
          <View className="flex-row items-center mb-4">
            <View className="bg-white/20 p-3 rounded-2xl mr-4">
              <Text className="text-3xl">🔥</Text>
            </View>
            <View className="flex-1">
              <Text className="text-white/80 font-medium uppercase tracking-wider text-xs">Current Streak</Text>
              <Text className="text-white text-3xl font-extrabold">{stats?.current_streak || 0} Days</Text>
            </View>
          </View>

          <View className="flex-row justify-around bg-black/10 rounded-2xl p-3 border border-white/10">
            <View className="items-center">
              <Text className="text-white/70 text-[10px] uppercase font-semibold">Scans Today</Text>
              <Text className="text-white font-bold text-base">{stats?.scans_today || 0}</Text>
            </View>
            <View className="w-[1px] bg-white/20" />
            <View className="items-center">
              <Text className="text-white/70 text-[10px] uppercase font-semibold">Total Scans</Text>
              <Text className="text-white font-bold text-base">{stats?.total_scans || 0}</Text>
            </View>
            <View className="w-[1px] bg-white/20" />
            <View className="items-center">
              <Text className="text-white/70 text-[10px] uppercase font-semibold">Level</Text>
              <Text className="text-white font-bold text-base">{stats?.level || 1}</Text>
            </View>
          </View>
        </View>

        {/* Daily Quizzes */}
        <View className="mb-6">
          <Text className="text-xl font-bold text-gray-900 mb-3">🧠 Daily Health Quiz</Text>
          {currentQuiz ? (
            <View className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-xs font-bold text-brand-green uppercase tracking-wider">
                  {currentQuiz.type.replace("_", " ")}
                </Text>
                <Text className="text-xs font-semibold text-gray-400">+{currentQuiz.xp_reward} XP</Text>
              </View>

              <Text className="font-bold text-gray-900 text-base mb-1">{currentQuiz.title}</Text>
              <Text className="text-gray-700 text-sm mb-4 leading-relaxed">{currentQuiz.question}</Text>

              {/* Options */}
              <View className="gap-2 mb-4">
                {(currentQuiz.options || ["True / Fact", "False / Myth"]).map((option, idx) => {
                  const isSelected = selectedOption === option;
                  return (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => handleQuizSubmit(option)}
                      disabled={quizResult !== null}
                      className={`p-3.5 rounded-xl border ${
                        isSelected
                          ? quizResult?.is_correct
                            ? "bg-green-50 border-green-600"
                            : "bg-red-50 border-red-600"
                          : "bg-gray-50 border-gray-200"
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          isSelected
                            ? quizResult?.is_correct
                              ? "text-green-800 font-bold"
                              : "text-red-800 font-bold"
                            : "text-gray-800"
                        }`}
                      >
                        {option}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Quiz Submission Result */}
              {quizResult && (
                <View
                  className={`p-4 rounded-xl mb-3 border ${
                    quizResult.is_correct
                      ? "bg-green-50 border-green-200"
                      : "bg-amber-50 border-amber-200"
                  }`}
                >
                  <Text
                    className={`font-bold text-sm mb-1 ${
                      quizResult.is_correct ? "text-green-800" : "text-amber-800"
                    }`}
                  >
                    {quizResult.is_correct ? "🎉 Correct! +" + quizResult.xp_earned + " XP" : "💡 Not quite right!"}
                  </Text>
                  <Text className="text-gray-700 text-xs leading-relaxed">{quizResult.explanation}</Text>

                  {quizzes.length > 1 && (
                    <TouchableOpacity
                      onPress={handleNextQuiz}
                      className="mt-3 bg-brand-green py-2 rounded-lg items-center"
                    >
                      <Text className="text-white text-xs font-bold">Next Question ➔</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          ) : (
            <View className="bg-white p-5 rounded-2xl border border-gray-100 items-center">
              <Text className="text-gray-500 text-sm">No quizzes available right now.</Text>
            </View>
          )}
        </View>

        {/* Badges */}
        <Text className="text-xl font-bold text-gray-900 mb-3">🏆 Badges & Achievements</Text>
        <View className="flex-row flex-wrap gap-3 mb-8">
          {(stats?.badges || []).map((badge) => (
            <View
              key={badge.id}
              className={`w-[30%] p-3 rounded-2xl items-center border shadow-xs ${
                badge.unlocked
                  ? "bg-white border-brand-lightGreen/50"
                  : "bg-gray-100 border-gray-200 opacity-50"
              }`}
            >
              <Text className="text-3xl mb-1.5">{badge.icon || "🏅"}</Text>
              <Text className="text-xs font-bold text-gray-800 text-center mb-0.5">{badge.name}</Text>
              <Text className="text-[9px] text-gray-500 text-center leading-tight">{badge.description}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          className="bg-white border border-brand-green py-3.5 rounded-full items-center mb-8"
          onPress={() => router.push("/")}
        >
          <Text className="text-brand-green text-base font-bold">🏠 Back to Onboarding Profile</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

