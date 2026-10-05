-- "On the shelf": owned but not started yet.
alter table books drop constraint books_status_check;
alter table books add constraint books_status_check check (status in ('reading','shelf','finished','set_aside'));
