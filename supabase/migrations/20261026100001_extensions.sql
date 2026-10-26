-- Extensions: pgvector for embeddings, pgmq for the job queue, pgcrypto for crypt()/gen_salt().
create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema extensions;
create extension if not exists pgmq;
