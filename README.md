docker cp ./dump.sql supabase_db_scienceclub-mail-service:/root/   

docker exec -it supabase_db_scienceclub-mail-service psql -U postgres -d postgres -f /root/dump.sql