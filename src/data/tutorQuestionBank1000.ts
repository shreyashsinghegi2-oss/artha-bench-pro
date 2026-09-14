import { QuizQuestion } from '../types';
import { TUTOR_QUESTION_BANK as BASE } from './tutorQuestionBank';
const extraTopics=['Cash Flow','Economics'];
const EXTRA:QuizQuestion[]=Array.from({length:50},(_,i)=>({
 id:`FIN-EXTRA-${String(i+1).padStart(3,'0')}`,topic:extraTopics[i%2],difficulty:(i%3===0?'advanced':i%3===1?'intermediate':'beginner') as QuizQuestion['difficulty'],
 question:i%2===0?`A learner earns ₹${20000+i*500} and spends ₹${15000+i*400}. What is the monthly cash surplus?`:`If a price is ₹${100+i} and rises by 10%, what is the new price before rounding?`,
 options:i%2===0?[`₹${5000+i*100}`,`₹${4500+i*100}`,`₹${6000+i*100}`,`₹${4000+i*100}`]:[`₹${(100+i)*1.1}`,`₹${(100+i)*0.9}`,`₹${100+i}`,`₹${(100+i)+10}`],correctAnswer:0,
 explanation:i%2===0?'Cash surplus equals income minus spending. This is a simplified arithmetic exercise with no taxes or other adjustments.':'A 10% increase means multiplying the starting price by 1.10.',formula:i%2===0?'Surplus = income − expenses':'New price = old price × 1.10',tags:i%2===0?['cash-flow','budget']:['inflation','percentage']
}));
export const TUTOR_QUESTION_BANK_1000=[...BASE,...EXTRA];
export const QUESTION_BANK_STATS={total:TUTOR_QUESTION_BANK_1000.length,topics:new Set(TUTOR_QUESTION_BANK_1000.map(q=>q.topic)).size};
export function selectAdaptiveQuizQuestions(length:5|10|20|50,level:'beginner'|'intermediate'|'advanced'='beginner',adaptive=true):QuizQuestion[]{const rank={beginner:0,intermediate:1,advanced:2};const pool=TUTOR_QUESTION_BANK_1000.filter(q=>adaptive?rank[q.difficulty]<=Math.min(2,rank[level]):q.difficulty===level);const source=pool.length>=length?pool:TUTOR_QUESTION_BANK_1000;return[...source].sort(()=>Math.random()-.5).slice(0,length);}
