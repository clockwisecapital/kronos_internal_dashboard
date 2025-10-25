import { login, signup } from '@/app/login/actions'
import { createClient } from '@/app/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function LoginPage() {
  // Check if user is already logged in
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (user) {
    redirect('/account')
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-md">
        <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/50 mx-auto mb-4">
              <span className="text-white font-bold text-2xl">C</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Clockwise Capital
            </h1>
            <p className="text-slate-400">
              Internal Dashboard Login
            </p>
          </div>

          <form className="space-y-6">
            <div>
              <label 
                htmlFor="email" 
                className="block text-sm font-medium text-slate-300 mb-2"
              >
                Email
              </label>
              <input 
                id="email" 
                name="email" 
                type="email" 
                required 
                className="w-full px-4 py-3 rounded-lg border-2 border-slate-600 bg-slate-700 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                placeholder="you@clockwisecapital.com"
              />
            </div>

            <div>
              <label 
                htmlFor="password" 
                className="block text-sm font-medium text-slate-300 mb-2"
              >
                Password
              </label>
              <input 
                id="password" 
                name="password" 
                type="password" 
                required 
                className="w-full px-4 py-3 rounded-lg border-2 border-slate-600 bg-slate-700 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                placeholder="••••••••"
              />
            </div>

            <div>
              <button 
                formAction={login}
                className="w-full py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-lg shadow-blue-500/20"
              >
                Sign In
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}