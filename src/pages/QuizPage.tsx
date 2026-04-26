import { useParams, useNavigate } from 'react-router-dom';
import { QuizPlayer } from '@/components/quiz/QuizPlayer';

const QuizPage = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();

  if (!quizId) return null;

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <QuizPlayer quizId={quizId} onBack={() => navigate(-1)} />
    </div>
  );
};

export default QuizPage;
