import { z } from 'zod'

export const LoginSchema = z.object({
    phone: z.string()
        .min(4, { message: 'Numéro de téléphone invalide' })
        .regex(/^[\d\s\-()]+$/, { message: 'Numéro de téléphone invalide' }),
    password: z.string()
        .min(1, { message: 'Le mot de passe est obligatoire' }),
    role: z.string().optional(),
})

export const InvitationSchema = z.object({
    fullName: z.string().min(2, { message: 'Le nom est trop court' }),
    email: z.string().email({ message: 'Email invalide' }).optional().or(z.literal('')),
    phone: z.string().min(4, { message: 'Numéro de téléphone requis' }),
    role: z.enum(['student', 'parent', 'teacher'], {
        required_error: 'Veuillez sélectionner un rôle',
    }),
})

export const CompleteRegistrationSchema = z.object({
    token: z.string().min(1, { message: 'Token invalide' }),
    pin: z.string()
        .length(6, { message: 'Le mot de passe doit contenir exactement 6 chiffres' })
        .regex(/^\d{6}$/, { message: 'Le mot de passe doit contenir uniquement des chiffres' }),
    confirmPin: z.string()
        .length(6, { message: 'Confirmez votre mot de passe' }),
}).refine((data) => data.pin === data.confirmPin, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPin'],
})
