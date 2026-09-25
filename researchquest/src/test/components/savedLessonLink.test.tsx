import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TaskCard } from "../../components/tasks/TaskCard";
import { savedAtlasLessonUrl } from "../../components/tasks/savedLessonLink";
import type { Task } from "../../types/database";

const lessonUrl = "https://learning-platform-chi-ten.vercel.app/learn/drug-discovery-lab/model-and-evidence/";
const description = `From Learning Platform\nSubject: Drug Discovery\nLesson: Model and evidence\nOpen lesson: ${lessonUrl}`;

describe("saved Atlas lesson links", () => {
  it("accepts an approved shared lesson and legacy subject page", () => {
    expect(savedAtlasLessonUrl(description)).toBe(lessonUrl);
    const futureLesson = "https://learning-platform-chi-ten.vercel.app/learn/drug-discovery-lab/future-model-check/";
    expect(savedAtlasLessonUrl(`From Learning Platform\nOpen lesson: ${futureLesson}`)).toBe(futureLesson);
    expect(savedAtlasLessonUrl("From Learning Platform\nOpen lesson: https://learning-platform-chi-ten.vercel.app/random-processes-lab/?page=markov"))
      .toBe("https://learning-platform-chi-ten.vercel.app/random-processes-lab/?page=markov");
    expect(savedAtlasLessonUrl("From Learning Platform\nOpen lesson: https://learning-platform-chi-ten.vercel.app/analysis-1-lab/reader.html#page=1"))
      .toBe("https://learning-platform-chi-ten.vercel.app/analysis-1-lab/reader.html#page=1");
    expect(savedAtlasLessonUrl("From Learning Platform\nOpen lesson: https://learning-platform-chi-ten.vercel.app/scientific-computing-ch1/index.html"))
      .toBe("https://learning-platform-chi-ten.vercel.app/scientific-computing-ch1/index.html");
  });

  it("rejects external origins, lookalike domains, unapproved paths, and ordinary task text", () => {
    for (const url of [
      "https://evil.example/learn/drug-discovery-lab/model-and-evidence/",
      "https://learning-platform-chi-ten.vercel.app.evil.example/learn/drug-discovery-lab/model-and-evidence/",
      "https://learning-platform-chi-ten.vercel.app/admin/",
      "https://learning-platform-chi-ten.vercel.app/learn/drug-discovery-lab/Bad_Slug/",
      "https://learning-platform-chi-ten.vercel.app/learn/drug-discovery-lab/future-model-check/admin/",
      "https://learning-platform-chi-ten.vercel.app/learn/drug-discovery-lab/../admin/",
      "javascript:alert(1)",
    ]) {
      expect(savedAtlasLessonUrl(`From Learning Platform\nOpen lesson: ${url}`)).toBeNull();
    }
    expect(savedAtlasLessonUrl(`Open lesson: ${lessonUrl}`)).toBeNull();
    expect(savedAtlasLessonUrl(`From Learning Platform\nOpen lesson: ${lessonUrl}\nOpen lesson: ${lessonUrl}`)).toBeNull();
  });

  it("renders a direct return link on the saved task card", () => {
    const task: Task = {
      id: "task-1", user_id: "user-1", title: "Practice model and evidence", description,
      priority: "medium", category: "Study", completed: false,
      created_at: "2026-09-23T00:00:00Z", updated_at: "2026-09-23T00:00:00Z",
    };
    render(<TaskCard task={task} onToggleComplete={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByRole("link", { name: "Return to lesson" })).toHaveAttribute("href", lessonUrl);
    expect(screen.getByText(/Subject: Drug Discovery/)).toBeInTheDocument();
    expect(screen.queryByText(/Open lesson: https/)).not.toBeInTheDocument();
  });
});
