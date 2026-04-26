import { IsEmail, IsString, MinLength, IsIn, IsOptional } from 'class-validator'

export class RegisterDto {
  @IsEmail()
  email: string

  @IsString()
  @MinLength(8)
  password: string

  @IsString()
  name: string

  @IsIn(['ATHLETE', 'RECRUITER'])
  @IsOptional()
  role?: string = 'ATHLETE'
}
