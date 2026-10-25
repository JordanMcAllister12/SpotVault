/*
# Fix Jordan McAllister avatar_url in user_profiles

Jordan's avatar_url was set to '/assets/profiles/ceopic.jpg' which is incorrect.
The correct canonical Jordan profile photo is '/assets/profiles/image.png'.
Bryan Paris uses '/assets/profiles/image copy.png' which is correct and unchanged.
*/

UPDATE user_profiles 
SET avatar_url = '/assets/profiles/image.png'
WHERE user_id = '17ca0743-ccdb-4d43-ab24-f84aa2821170'
  AND avatar_url != '/assets/profiles/image.png';
