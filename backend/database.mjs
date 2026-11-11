import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
export const hash=value=>createHash('sha256').update(value).digest('hex');
export const token=()=>randomBytes(32).toString('hex');
export function passwordHash(password){const salt=randomBytes(16).toString('hex');return `${salt}:${scryptSync(password,salt,64).toString('hex')}`}
export function passwordMatches(password,encoded){try{const [salt,key]=encoded.split(':');const result=scryptSync(password,salt,64),expected=Buffer.from(key,'hex');return expected.length===result.length&&timingSafeEqual(expected,result)}catch{return false}}
export const publicUser=row=>({id:row.id,name:row.name,email:row.email,role:row.role});
export function openDatabase(path){
 if(path!==':memory:')mkdirSync(dirname(path),{recursive:true,mode:0o700});const db=new DatabaseSync(path);
 db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','teacher','student')),disabled INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,csrf_token TEXT NOT NULL,expires_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS completions(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,lesson_id TEXT NOT NULL,completed_at INTEGER NOT NULL,PRIMARY KEY(user_id,lesson_id));
 CREATE TABLE IF NOT EXISTS plans(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,lesson_id TEXT NOT NULL,PRIMARY KEY(user_id,lesson_id));
 CREATE TABLE IF NOT EXISTS attempts(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,subject TEXT NOT NULL,score INTEGER NOT NULL,total INTEGER NOT NULL,answers TEXT NOT NULL,question_ids TEXT NOT NULL,created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS teacher_students(teacher_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,PRIMARY KEY(teacher_id,student_id));
 CREATE TABLE IF NOT EXISTS assignments(id TEXT PRIMARY KEY,teacher_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,lesson_id TEXT NOT NULL,created_at INTEGER NOT NULL,UNIQUE(teacher_id,student_id,lesson_id));
 CREATE TABLE IF NOT EXISTS ai_usage(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,count INTEGER NOT NULL,expires_at INTEGER NOT NULL);`);
 return db;
}
