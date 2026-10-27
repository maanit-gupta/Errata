-- P15: server-side size limits on the private buckets (defence in depth behind the 4 MB check in
-- the web server actions), and a MIME allow-list on drafts, whose types the submit action already
-- validates. Renders are worker-written PNG pages (PDF_RENDER_MAX_SIDE 1400 px).
update storage.buckets set file_size_limit = 5242880 where id in ('guides', 'assets');
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array[
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/pdf', 'image/png', 'image/jpeg', 'image/webp'
    ]
where id = 'drafts';
update storage.buckets
set file_size_limit = 10485760, allowed_mime_types = array['image/png']
where id = 'renders';
