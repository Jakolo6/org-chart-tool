-- Update the handle_new_user function to properly use the display_name from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    new.id, 
    COALESCE(
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1)
    )
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing profile for your user
UPDATE public.profiles
SET display_name = 'Jakob Lindner'
WHERE id = (SELECT id FROM auth.users WHERE email = 'jakob.lindner@nunatak.com');
