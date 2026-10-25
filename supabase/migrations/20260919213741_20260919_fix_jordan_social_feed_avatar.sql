/*
# Fix Jordan Social Feed avatar and remove duplicates

Previous migration seeded 5 Jordan posts with wrong avatar '/assets/profiles/ceopic.jpg'.
New migration seeded 5 correct posts with '/assets/profiles/image.png'.
Remove the old wrong-avatar duplicates to keep the feed clean.
*/

DELETE FROM network_chat_messages 
WHERE author_id = '17ca0743-ccdb-4d43-ab24-f84aa2821170' 
  AND author_avatar = '/assets/profiles/ceopic.jpg';
