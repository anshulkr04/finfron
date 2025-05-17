import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jcghcmwqiyfiuhwetttt.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjZ2hjbXdxaXlmaXVod2V0dHR0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI4ODYxNjEsImV4cCI6MjA1ODQ2MjE2MX0.l8LWf12g7gOIyUOA0bMYyWC0QRplFwCY2DyG-zgTWqM'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)