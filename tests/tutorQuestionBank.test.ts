import { describe,it,expect } from 'vitest';
import { TUTOR_QUESTION_BANK,QUESTION_BANK_STATS,selectQuizQuestions } from '../src/data/tutorQuestionBank';

describe('adaptive tutor question bank',()=>{
 it('contains 1000 validated questions',()=>{expect(QUESTION_BANK_STATS.total).toBe(1000);expect(new Set(TUTOR_QUESTION_BANK.map(q=>q.id)).size).toBe(1000);});
 it('has valid answer keys and four options',()=>{for(const q of TUTOR_QUESTION_BANK){expect(q.options).toHaveLength(4);expect(q.correctAnswer).toBeGreaterThanOrEqual(0);expect(q.correctAnswer).toBeLessThan(4);expect(q.question.length).toBeGreaterThan(10);expect(q.explanation.length).toBeGreaterThan(10);}});
 it('supports requested test lengths',()=>{for(const n of [5,10,20,50] as const)expect(selectQuizQuestions(n,'beginner',true)).toHaveLength(n);});
 it('covers finance topics',()=>{expect(new Set(TUTOR_QUESTION_BANK.map(q=>q.topic)).size).toBeGreaterThanOrEqual(10);});
});
